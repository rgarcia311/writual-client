import type { Buffer } from 'node:buffer';
import {
  screenplayDocSchema,
  type ScreenplayDoc,
  type ScriptBlock,
} from './screenplaySchema';
import {
  entitiesFromDoc,
  type ImportCharacter,
  type ImportScene,
} from './entitiesFromDoc';
import type { AIProvider, CompletionParams } from './providers/types';
import { isRetryableError, getRetryAfterMs, buildProviderErrorDetail } from './providers/errorUtils';
import { calculateRoughTokenEstimate } from './tokenEstimate';

const MAX_RETRIES_PER_CHUNK = 4;
const RETRY_BASE_MS = 800;
const TITLE_SEARCH_DEPTH = 3;

const END_MARKERS = /^(FADE\s+OUT\.?|THE\s+END\.?|FADE\s+TO\s+BLACK\.?)$/i;

/** Hard cap on characters of full plain text (defensive; PDF text is already bounded by page count). */
export const MAX_PLAINTEXT_CHARS = 200_000;

// pdf-parse is CommonJS; keep require for node/ts compatibility.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{
  numpages: number;
  text: string;
}>;

/** Scene heading at the start of a line (align with web `parseScreenplayPdf` heuristics). */
const SCENE_LINE_RE = /^(INT\.|EXT\.|INT\.\s*\/\s*EXT|INT\/EXT|I\/E\.?)\s+/i;

const CHUNK_SYSTEM_BASE = `You convert a segment of screenplay plain text into structured JSON for a TipTap editor.

Output a single top-level JSON object with this shape:
- "content": an array of scriptBlocks.
- "titleHint": string or null. Guess from a title page if this segment is the very front of the script.
- "logline": string or null. A one-sentence story summary, only if found in a title page or opening.
- "authors": array of strings or null. Writer names from a title page, only if found.
- "genre": string or null. Genre label if explicitly stated.

Each item in "content" must be a scriptBlock exactly like this:
{ "type": "scriptBlock", "attrs": { "elementType": "<type>" }, "content": [{ "type": "text", "text": "..." }] }

elementType must be exactly one of: action, slugline, character, parenthetical, dialogue, transition, title, author, contact.

CRITICAL RULES:
1. SEPARATION: "character", "parenthetical", and "dialogue" MUST ALWAYS be in separate, consecutive scriptBlocks. NEVER combine a character name and their dialogue into a single block.
2. CHARACTER BLOCKS: The "character" block should only contain the capitalized name and any extensions like (V.O.) or (CONT'D).
3. DIALOGUE BLOCKS: The "dialogue" block contains only the spoken words. Merge multi-line dialogue from the same speaker into one dialogue block.
4. NEWLINES: Do not use literal "\\n" characters to separate distinct screenplay elements. Distinct elements require distinct JSON objects. Use "\\n" only for line breaks within a single "action" or "dialogue" block.
5. SLUGLINES: Scene headings (INT., EXT., I/E, etc.) are "slugline".
6. TITLE PAGE: Format the main script title as a "title" block, the "Written by" lines and author names as "author" blocks, and any contact information (address, phone, email) as "contact" blocks. Also extract the title to the "titleHint" property.
7. NO TRUNCATION: You MUST process the ENTIRE segment of text provided. Convert every single line into a scriptBlock. Do not omit or summarize anything.

EXAMPLE INPUT:
EXT. WOODS - NIGHT
Harold lets Claire down gently on a nearby rock. She notices his packed truck.

CLAIRE
You live in there or something?
Sorry that was rude.

Confused by the assumption Harold takes a beat.

HAROLD
I'm moving.

EXAMPLE OUTPUT:
{
  "titleHint": null,
  "content": [
    {
      "type": "scriptBlock",
      "attrs": { "elementType": "slugline" },
      "content": [{ "type": "text", "text": "EXT. WOODS - NIGHT" }]
    },
    {
      "type": "scriptBlock",
      "attrs": { "elementType": "action" },
      "content": [{ "type": "text", "text": "Harold lets Claire down gently on a nearby rock. She notices his packed truck." }]
    },
    {
      "type": "scriptBlock",
      "attrs": { "elementType": "character" },
      "content": [{ "type": "text", "text": "CLAIRE" }]
    },
    {
      "type": "scriptBlock",
      "attrs": { "elementType": "dialogue" },
      "content": [{ "type": "text", "text": "You live in there or something?\\nSorry that was rude." }]
    },
    {
      "type": "scriptBlock",
      "attrs": { "elementType": "action" },
      "content": [{ "type": "text", "text": "Confused by the assumption Harold takes a beat." }]
    },
    {
      "type": "scriptBlock",
      "attrs": { "elementType": "character" },
      "content": [{ "type": "text", "text": "HAROLD" }]
    },
    {
      "type": "scriptBlock",
      "attrs": { "elementType": "dialogue" },
      "content": [{ "type": "text", "text": "I'm moving." }]
    }
  ]
}

NEVER put segment or part labels (such as "P1/5", "Part 2 of 5", "Page 1/5", or any internal import markers) in the screenplay "text" fields. Output only real screenplay copy. No markdown, no text outside the JSON object.

Now, parse the following segment:`;

const CHUNK_SYSTEM_MIDDLE = `

[Internal] This is a middle or ending segment of a longer screenplay. Only convert the text in the user message; do not invent missing scenes. Set "titleHint" to null or omit it.`;

const CHUNK_SYSTEM_FIRST = `

[Internal] This is the first segment of a multi-part import. If a title is obvious, set "titleHint" to a short string; otherwise null.`;

function trimEndPerLine(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');
}

function trimDocumentTrailingEdges(s: string): string {
  return s.replace(/\n+$/, '').replace(/ +$/, '');
}

function normalizeScreenplayPlainText(raw: string): string {
  let t = raw.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/[​-‍﻿]/g, '').replace(/­/g, '');
  t = trimEndPerLine(t);
  t = cleanPdfPlainTextForGroqImport(t);
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/^\n+/, '');
  return trimDocumentTrailingEdges(t);
}

export function cleanPdfPlainTextForGroqImport(plain: string): string {
  const PAGE_FENCE_RE = /^---\s*PAGE\s+\d+(?:\s+of\s+\d+)?\s*---\s*$/i;
  const STANDALONE_PAGE_NUM_RE = /^\d{1,4}\.?\s*$/;
  const PAGE_TAG_RE = /<\/?(?:pagebreak|page)\b[^>]*\/?>(?:\n)?/gi;

  let s = plain.replace(/\f/g, '\n');
  s = s.replace(PAGE_TAG_RE, (m) => (m.endsWith('\n') ? '\n' : ''));

  const lines = s.split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (PAGE_FENCE_RE.test(t)) continue;
    if (STANDALONE_PAGE_NUM_RE.test(t) && t.length > 0) continue;
    kept.push(line);
  }
  s = kept.join('\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function buildPlainTextChunks(plain: string, maxChunkChars: number): string[] {
  if (!plain) return [];

  const lines = plain.split('\n');
  const sceneSections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isScene = SCENE_LINE_RE.test(line.trim());
    if (isScene && current.length > 0) {
      const joined = trimEndPerLine(current.join('\n'));
      if (joined) sceneSections.push(joined);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) {
    const joined = trimEndPerLine(current.join('\n'));
    if (joined) sceneSections.push(joined);
  }

  const out: string[] = [];
  for (const section of sceneSections) {
    out.push(...subSplitOversizedSection(section, maxChunkChars));
  }
  return out.filter((c) => c.length > 0);
}

function subSplitOversizedSection(section: string, maxChars: number): string[] {
  if (section.length <= maxChars) return [section];
  const parts: string[] = [];
  let i = 0;
  while (i < section.length) {
    if (i + maxChars >= section.length) {
      const rest = trimEndPerLine(section.slice(i));
      if (rest) parts.push(rest);
      break;
    }
    const window = section.slice(i, i + maxChars);
    let relBreak = window.lastIndexOf('\n\n');
    if (relBreak < maxChars * 0.1) {
      relBreak = window.lastIndexOf('\n', maxChars - 1);
    }
    if (relBreak <= 0) relBreak = maxChars;
    const piece = trimEndPerLine(section.slice(i, i + relBreak));
    if (piece) parts.push(piece);
    i = i + relBreak;
    while (i < section.length && (section[i] === '\n' || section[i] === '\r')) {
      i += 1;
    }
  }
  return parts;
}

const SEGMENT_TAG_RE = /\bP\d+\/\d+:\s*/g;

function stripLeakedImportMarkersInBlocks(blocks: ScriptBlock[]): ScriptBlock[] {
  return blocks.map((b) => ({
    ...b,
    content: b.content.map((n) => ({
      ...n,
      text:
        typeof n.text === 'string'
          ? n.text.replace(SEGMENT_TAG_RE, '').replace(/^\s*P\d+\/\d+:\s*/gm, '')
          : n.text,
    })),
  }));
}

function splitStuckCharacterNameAndDialogue(blocks: ScriptBlock[]): ScriptBlock[] {
  const out: ScriptBlock[] = [];
  for (const b of blocks) {
    if (b.type !== 'scriptBlock' || b.attrs?.elementType !== 'character') {
      out.push(b);
      continue;
    }
    const t = b.content
      .map((n) => (n.type === 'text' && typeof n.text === 'string' ? n.text : ''))
      .join('');
    if (!t || t.includes('\n') || t.length < 3) {
      out.push(b);
      continue;
    }
    let splitAt = -1;
    for (let i = 1; i < t.length - 1; i += 1) {
      if (/[A-Z]/.test(t[i]!) && /[a-z]/.test(t[i + 1]!)) {
        const namePart = t.slice(0, i).trim();
        if (namePart.length < 2) continue;
        if (!/^[A-Z0-9'.\s()\-–]+$/.test(namePart)) continue;
        splitAt = i;
        break;
      }
    }
    if (splitAt < 0) { out.push(b); continue; }
    const namePart = t.slice(0, splitAt).trim();
    const rest = t.slice(splitAt).trim();
    if (!namePart || !rest) { out.push(b); continue; }
    out.push({
      type: 'scriptBlock',
      attrs: { elementType: 'character' },
      content: [{ type: 'text', text: namePart }],
    });
    out.push({
      type: 'scriptBlock',
      attrs: { elementType: 'dialogue' },
      content: [{ type: 'text', text: rest }],
    });
  }
  return out;
}

function ensureClosingTransition(blocks: ScriptBlock[]): ScriptBlock[] {
  const lastText = blocks[blocks.length - 1]?.content[0]?.text?.trim() ?? '';
  if (END_MARKERS.test(lastText)) {
    if (blocks[blocks.length - 1]!.attrs.elementType !== 'transition') {
      const updated = [...blocks];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1]!,
        attrs: { elementType: 'transition' },
      };
      return updated;
    }
    return blocks;
  }
  // Check last 5 blocks for buried end markers
  const start = Math.max(0, blocks.length - 5);
  for (let i = blocks.length - 1; i >= start; i--) {
    const text = blocks[i]!.content[0]?.text?.trim() ?? '';
    if (END_MARKERS.test(text) && blocks[i]!.attrs.elementType !== 'transition') {
      const updated = [...blocks];
      updated[i] = { ...updated[i]!, attrs: { elementType: 'transition' } };
      return updated;
    }
  }
  return blocks;
}

function chunkBackoffMs(attempt: number, err: unknown): number {
  const fromHeader = getRetryAfterMs(err);
  const exponential = RETRY_BASE_MS * 2 ** attempt;
  return Math.max(exponential, fromHeader ?? 0, 1_000);
}

interface ChunkCallInput {
  provider: AIProvider;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  requestTimeoutMs: number;
  contextWindowTokens: number;
  tokensPerChar: number;
  userMessage: string;
  chunkIndex: number;
  totalChunks: number;
  correlationId: string;
  projectId?: string;
}

async function parseOneChunk(input: ChunkCallInput): Promise<{
  content: ScreenplayDoc['content'];
  titleHint?: string | null;
  logline?: string | null;
  authors?: string[] | null;
  genre?: string | null;
}> {
  const { chunkIndex, totalChunks } = input;
  const isFirst = chunkIndex === 0;
  const isLast = chunkIndex === totalChunks - 1;

  const segmentNote =
    totalChunks > 1
      ? `\n\n[Internal] This is segment ${chunkIndex + 1} of ${totalChunks} of one screenplay. The user message contains only this segment. Do not echo segment numbers, "P1/5", or any part labels in the JSON.${isLast ? ' This is the final segment.' : ''}`
      : '';

  const systemPrompt =
    CHUNK_SYSTEM_BASE +
    (totalChunks > 1 && isFirst ? CHUNK_SYSTEM_FIRST : '') +
    (totalChunks > 1 && !isFirst ? CHUNK_SYSTEM_MIDDLE : '') +
    segmentNote;

  const params: CompletionParams = {
    systemPrompt,
    userMessage: input.userMessage,
    model: input.model,
    maxOutputTokens: input.maxOutputTokens,
    temperature: input.temperature,
    requestTimeoutMs: input.requestTimeoutMs,
    contextWindowTokens: input.contextWindowTokens,
    tokensPerChar: input.tokensPerChar,
    chunkIndex,
    totalChunks,
    isLastChunk: isLast,
    correlationId: input.correlationId,
    projectId: input.projectId,
  };

  const result = await input.provider.generateCompletion(params);
  return {
    content: result.content,
    titleHint: result.titleHint,
    logline: result.logline,
    authors: result.authors,
    genre: result.genre,
  };
}

async function parseOneChunkWithRetries(
  input: ChunkCallInput,
  providerName: string,
): Promise<{
  content: ScreenplayDoc['content'];
  titleHint?: string | null;
  logline?: string | null;
  authors?: string[] | null;
  genre?: string | null;
}> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES_PER_CHUNK; attempt++) {
    try {
      return await parseOneChunk(input);
    } catch (e) {
      lastError = e;
      if (!isRetryableError(e)) throw e;
      if (attempt < MAX_RETRIES_PER_CHUNK - 1) {
        await sleep(chunkBackoffMs(attempt, e));
      }
    }
  }
  const detail = buildProviderErrorDetail(lastError, {
    provider: providerName,
    model: input.model,
    chunkIndex: input.chunkIndex,
  });
  console.error(JSON.stringify({ event: 'chunk_error', ...detail }));
  throw lastError instanceof Error
    ? lastError
    : new Error(`Chunk ${input.chunkIndex} failed after retries`);
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]!();
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

export interface ParseScreenplayResult {
  doc: ScreenplayDoc;
  pageCount: number;
  titleHint: string | null;
  logline: string | null;
  authors: string[] | null;
  genre: string | null;
  characters: ImportCharacter[];
  scenes: ImportScene[];
  status: 'OK' | 'PARTIAL';
  unprocessedChunkIndices: number[];
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    latencyMs: number;
  };
}

export interface ParseScreenplayParams {
  plainText: string;
  pageCount: number;
  provider: AIProvider;
  providerName: string;
  model: string;
  maxChunkChars: number;
  maxOutputTokensPerChunk: number;
  contextWindowTokens: number;
  tokensPerChar: number;
  chunkInterDelayMs: number;
  temperature: number;
  requestTimeoutMs: number;
  maxConcurrency: number;
  maxTotalChunksPerRequest: number;
  maxTotalTokensPerRequest: number;
  correlationId: string;
  projectId?: string;
}

export async function parseScreenplay(
  params: ParseScreenplayParams,
): Promise<ParseScreenplayResult> {
  const {
    plainText,
    pageCount,
    provider,
    providerName,
    model,
    maxChunkChars,
    maxOutputTokensPerChunk,
    contextWindowTokens,
    tokensPerChar,
    chunkInterDelayMs,
    temperature,
    requestTimeoutMs,
    maxConcurrency,
    maxTotalChunksPerRequest,
    maxTotalTokensPerRequest,
    correlationId,
    projectId,
  } = params;

  const rawSlice =
    plainText.length > MAX_PLAINTEXT_CHARS
      ? plainText.slice(0, MAX_PLAINTEXT_CHARS)
      : plainText;
  const trimmed = normalizeScreenplayPlainText(rawSlice);

  if (!trimmed.trim()) {
    throw new Error('No extractable text in PDF');
  }

  const chunkTexts = buildPlainTextChunks(trimmed, maxChunkChars);
  if (chunkTexts.length === 0) {
    throw new Error('No text chunks to convert');
  }

  // Global safety caps
  if (chunkTexts.length > maxTotalChunksPerRequest) {
    throw new Error(
      `Screenplay splits into ${chunkTexts.length} chunks, exceeding maxTotalChunksPerRequest=${maxTotalChunksPerRequest}. ` +
        `Increase chunkMaxChars or raise the cap in ai-config.json.`,
    );
  }
  const roughInputTokens = chunkTexts.reduce(
    (s, c) => s + calculateRoughTokenEstimate(c, tokensPerChar),
    0,
  );
  const roughTotalTokens = roughInputTokens + chunkTexts.length * maxOutputTokensPerChunk;
  if (roughTotalTokens > maxTotalTokensPerRequest) {
    throw new Error(
      `Estimated ${roughTotalTokens} tokens exceeds maxTotalTokensPerRequest=${maxTotalTokensPerRequest}. ` +
        `Adjust limits in ai-config.json.`,
    );
  }

  const total = chunkTexts.length;
  const allBlocks: ScreenplayDoc['content'] = [];
  const unprocessedChunkIndices: number[] = [];

  let titleHint: string | null = null;
  let logline: string | null = null;
  let authors: string[] | null = null;
  let genre: string | null = null;
  let titleLocked = false;
  let loglineLocked = false;
  let authorsLocked = false;
  let genreLocked = false;

  const totalUsage = {
    promptTokens: 0,
    completionTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    latencyMs: 0,
  };

  const buildTask = (i: number, segment: string) => async () => {
    try {
      const result = await parseOneChunkWithRetries(
        {
          provider,
          model,
          maxOutputTokens: maxOutputTokensPerChunk,
          temperature,
          requestTimeoutMs,
          contextWindowTokens,
          tokensPerChar,
          userMessage: segment,
          chunkIndex: i,
          totalChunks: total,
          correlationId,
          projectId,
        },
        providerName,
      );
      return { i, result, skipped: false as const };
    } catch (e) {
      const detail = buildProviderErrorDetail(e, { provider: providerName, model, chunkIndex: i });
      console.error(JSON.stringify({ event: 'chunk_skipped', ...detail }));
      return { i, result: null, skipped: true as const };
    }
  };

  if (maxConcurrency === 1) {
    // Sequential path: respect chunkInterDelayMs between calls
    for (let i = 0; i < total; i++) {
      if (i > 0 && chunkInterDelayMs > 0) await sleep(chunkInterDelayMs);
      const { result, skipped } = await buildTask(i, chunkTexts[i]!)();
      if (skipped || !result) {
        unprocessedChunkIndices.push(i);
        continue;
      }
      for (const b of result.content) allBlocks.push(b);
      // Capture and lock metadata
      if (!titleLocked && i < TITLE_SEARCH_DEPTH && result.titleHint) {
        const t = String(result.titleHint).trim();
        if (t) { titleHint = t; titleLocked = true; }
      }
      if (!loglineLocked && i < TITLE_SEARCH_DEPTH && result.logline) {
        const t = String(result.logline).trim();
        if (t) { logline = t; loglineLocked = true; }
      }
      if (!authorsLocked && i < TITLE_SEARCH_DEPTH && result.authors?.length) {
        authors = result.authors; authorsLocked = true;
      }
      if (!genreLocked && i < TITLE_SEARCH_DEPTH && result.genre) {
        const t = String(result.genre).trim();
        if (t) { genre = t; genreLocked = true; }
      }
    }
  } else {
    // Concurrent path: run up to maxConcurrency tasks at a time
    const tasks = chunkTexts.map((segment, i) => buildTask(i, segment));
    const outcomes = await runWithConcurrency(tasks, maxConcurrency);

    for (const outcome of outcomes) {
      if (outcome.skipped || !outcome.result) {
        unprocessedChunkIndices.push(outcome.i);
        continue;
      }
      for (const b of outcome.result.content) allBlocks.push(b);
      const i = outcome.i;
      const result = outcome.result;
      if (!titleLocked && i < TITLE_SEARCH_DEPTH && result.titleHint) {
        const t = String(result.titleHint).trim();
        if (t) { titleHint = t; titleLocked = true; }
      }
      if (!loglineLocked && i < TITLE_SEARCH_DEPTH && result.logline) {
        const t = String(result.logline).trim();
        if (t) { logline = t; loglineLocked = true; }
      }
      if (!authorsLocked && i < TITLE_SEARCH_DEPTH && result.authors?.length) {
        authors = result.authors; authorsLocked = true;
      }
      if (!genreLocked && i < TITLE_SEARCH_DEPTH && result.genre) {
        const t = String(result.genre).trim();
        if (t) { genre = t; genreLocked = true; }
      }
    }
  }

  if (allBlocks.length === 0) {
    throw new Error('Model produced no script blocks for this screenplay');
  }

  const blocksSanitized = ensureClosingTransition(
    splitStuckCharacterNameAndDialogue(
      stripLeakedImportMarkersInBlocks(allBlocks),
    ),
  );

  const doc: ScreenplayDoc = { type: 'doc', content: blocksSanitized };
  screenplayDocSchema.parse(doc);
  const { characters, scenes } = entitiesFromDoc(doc);

  console.log(JSON.stringify({
    event: 'request_complete',
    correlationId,
    projectId: projectId ?? null,
    status: unprocessedChunkIndices.length > 0 ? 'PARTIAL' : 'OK',
    totalChunks: total,
    unprocessedChunks: unprocessedChunkIndices.length,
    totalUsage,
  }));

  return {
    doc,
    pageCount,
    titleHint,
    logline,
    authors,
    genre,
    characters,
    scenes,
    status: unprocessedChunkIndices.length > 0 ? 'PARTIAL' : 'OK',
    unprocessedChunkIndices,
    totalUsage,
  };
}

export async function extractScriptPlainTextFromPdf(
  fileBuffer: Buffer,
): Promise<{ text: string; pageCount: number }> {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Empty PDF buffer');
  }
  const data = await pdfParse(fileBuffer);
  const raw = typeof data.text === 'string' ? data.text : String(data.text ?? '');
  const text = normalizeScreenplayPlainText(raw);
  const pageCount =
    typeof data.numpages === 'number' && data.numpages >= 0 ? data.numpages : 0;
  return { text, pageCount };
}

export async function importScreenplayFromPdfBuffer(
  fileBuffer: Buffer,
  options: Omit<ParseScreenplayParams, 'plainText' | 'pageCount'>,
): Promise<ParseScreenplayResult> {
  const { text, pageCount } = await extractScriptPlainTextFromPdf(fileBuffer);
  if (!text.trim()) {
    throw new Error('No extractable text (scanned PDF?). Use a text-based PDF.');
  }
  return parseScreenplay({ plainText: text, pageCount, ...options });
}
