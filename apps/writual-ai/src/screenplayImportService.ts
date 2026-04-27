import type { Buffer } from 'node:buffer';
import Groq from 'groq-sdk';
import {
  groqChunkResponseSchema,
  screenplayDocSchema,
  type ScreenplayDoc,
  type ScriptBlock,
} from './screenplaySchema';
import {
  entitiesFromDoc,
  type ImportCharacter,
  type ImportScene,
} from './entitiesFromDoc';

/** Conservative default: ~1–1.5k tokens user text; Groq on_demand ~6k TPM per request (input+reserved output). */
const DEFAULT_MAX_CHUNK_CHARS = 4_500;
/** Aligned to low-TPM tiers: input + max_tokens + system must stay under ~6k. */
const DEFAULT_GROQ_MAX_OUTPUT_TOKENS_PER_CHUNK = 2_048;
/** If sum of (maxChunkChars/3) + maxOut exceeds this, log a pre-flight warning. */
const TPM_WARNING_THRESHOLD = 6_000;

const MAX_RETRIES_PER_CHUNK = 4;
const RETRY_BASE_MS = 800;

function getChunkInterDelayMs(): number {
  const raw = process.env.GROQ_CHUNK_INTER_DELAY_MS ?? '200';
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 200;
}

/**
 * Per-completion cap (one chunk, not the whole screenplay). Overridable for TPM tuning.
 * @see https://console.groq.com/docs/rate-limits
 */
function getMaxOutputTokensPerChunk(): number {
  const raw = process.env.GROQ_MAX_OUTPUT_TOKENS_PER_CHUNK ?? String(DEFAULT_GROQ_MAX_OUTPUT_TOKENS_PER_CHUNK);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_GROQ_MAX_OUTPUT_TOKENS_PER_CHUNK;
}

function getMaxChunkChars(): number {
  const raw = process.env.SCREENPLAY_CHUNK_MAX_CHARS ?? String(DEFAULT_MAX_CHUNK_CHARS);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_CHUNK_CHARS;
}

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

Each item in "content" must be a scriptBlock exactly like this:
{ "type": "scriptBlock", "attrs": { "elementType": "<type>" }, "content": [{ "type": "text", "text": "..." }] }

elementType must be exactly one of: action, slugline, character, parenthetical, dialogue, transition.

CRITICAL RULES:
1. SEPARATION: "character", "parenthetical", and "dialogue" MUST ALWAYS be in separate, consecutive scriptBlocks. NEVER combine a character name and their dialogue into a single block.
2. CHARACTER BLOCKS: The "character" block should only contain the capitalized name and any extensions like (V.O.) or (CONT'D).
3. DIALOGUE BLOCKS: The "dialogue" block contains only the spoken words. Merge multi-line dialogue from the same speaker into one dialogue block.
4. NEWLINES: Do not use literal "\\n" characters to separate distinct screenplay elements. Distinct elements require distinct JSON objects. Use "\\n" only for line breaks within a single "action" or "dialogue" block.
5. SLUGLINES: Scene headings (INT., EXT., I/E, etc.) are "slugline".
6. TITLE PAGE: If the text contains title page information (Title, Written by, Contact info), format it as "action" blocks, but extract the title to the "titleHint" property.

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

/**
 * Trims end-of-line spaces only; preserves leading margin whitespace (screenplay layout).
 */
function trimEndPerLine(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');
}

/**
 * Trims only trailing newlines/space at the very end; does not touch leading line indentation.
 */
function trimDocumentTrailingEdges(s: string): string {
  return s.replace(/\n+$/, '').replace(/ +$/, '');
}

/**
 * `pdf-parse` string only, never the PDF buffer, is sent to Groq. Removes PDF noise; does not strip
 * leading spaces on lines (margins for character/dialogue).
 */
function normalizeScreenplayPlainText(raw: string): string {
  let t = raw.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00AD/g, '');
  t = trimEndPerLine(t);
  t = cleanPdfPlainTextForGroqImport(t);
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/^\n+/, '');
  return trimDocumentTrailingEdges(t);
}

/**
 * Pre-processing for PDF-extracted text before chunking and before Groq: removes page markers,
 * footer page numbers, and parser-generated page-break tags/characters.
 */
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
    if (PAGE_FENCE_RE.test(t)) {
      continue;
    }
    if (STANDALONE_PAGE_NUM_RE.test(t) && t.length > 0) {
      continue;
    }
    kept.push(line);
  }
  s = kept.join('\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const o = err as { status?: number; response?: { status?: number } };
  if (typeof o.status === 'number') return o.status;
  if (typeof o.response?.status === 'number') return o.response.status;
  return undefined;
}

/** Groq: retry 429 and 5xx only; never retry 413 (payload / TPM preflight will fail the same). */
function isRetryableGroqHttpError(err: unknown): boolean {
  const s = getHttpStatus(err);
  if (s === 413) return false;
  if (s === 429) return true;
  if (s !== undefined && s >= 500) return true;
  return false;
}

function getRetryAfterMsFromError(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const o = err as { response?: { headers?: unknown } } & { headers?: unknown };
  const h = o.response && typeof o.response === 'object' && o.response !== null
    ? (o.response as { headers?: unknown }).headers
    : o.headers;
  if (h == null) return null;

  const getHeader = (name: string): string | undefined => {
    if (typeof (h as Headers).get === 'function') {
      return (h as Headers).get(name) ?? (h as Headers).get(name.toLowerCase()) ?? undefined;
    }
    const rec = h as Record<string, string | undefined>;
    return rec[name] ?? rec[name.toLowerCase()];
  };

  const ra = getHeader('retry-after');
  if (ra != null) {
    const sec = Number(ra);
    if (Number.isFinite(sec) && sec >= 0) {
      return sec * 1000;
    }
  }
  return null;
}

function logPreflightTpmIfRisky(maxChunkChars: number, maxOut: number): void {
  const rough = Math.ceil(maxChunkChars / 3) + maxOut;
  if (rough > TPM_WARNING_THRESHOLD) {
    console.warn(
      `[screenplay import] Per-request size may exceed low-tier Groq TPM (rough estimate ${rough} vs ~${TPM_WARNING_THRESHOLD}): ` +
        `lower SCREENPLAY_CHUNK_MAX_CHARS (now ${maxChunkChars}) and/or GROQ_MAX_OUTPUT_TOKENS_PER_CHUNK (now ${maxOut}).`,
    );
  }
}

/**
 * Split into scene-sized sections, then sub-split so no chunk exceeds `maxChunkChars` (stays
 * within model input window with room for the system prompt and JSON output).
 */
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
    if (relBreak <= 0) {
      relBreak = maxChars;
    }
    const piece = trimEndPerLine(section.slice(i, i + relBreak));
    if (piece) parts.push(piece);
    i = i + relBreak;
    while (i < section.length && (section[i] === '\n' || section[i] === '\r')) {
      i += 1;
    }
  }
  return parts;
}

export interface ParseScreenplayWithGroqResult {
  doc: ScreenplayDoc;
  pageCount: number;
  titleHint: string | null;
  characters: ImportCharacter[];
  scenes: ImportScene[];
}

/**
 * Step 1: read bytes with pdf-parse and return only data.text (never pass the buffer to the LLM).
 */
export async function extractScriptPlainTextFromPdf(
  fileBuffer: Buffer,
): Promise<{ text: string; pageCount: number }> {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Empty PDF buffer');
  }
  const data = await pdfParse(fileBuffer);
  const raw = typeof data.text === 'string' ? data.text : String(data.text ?? '');
  const text = normalizeScreenplayPlainText(raw);
  const pageCount = typeof data.numpages === 'number' && data.numpages >= 0 ? data.numpages : 0;
  return { text, pageCount };
}

const VALID_ELEMENT_TYPES = new Set([
  'action',
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
]);

/**
 * Groq sometimes omits `content` on a scriptBlock or returns an empty array; Zod requires
 * `content` with ≥1 text node. Coerce so validation matches what the editor needs.
 */
function normalizeGroqChunkPayload(parsed: unknown): unknown {
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return parsed;
  }
  const o = parsed as Record<string, unknown>;
  const rawContent = o.content;
  if (!Array.isArray(rawContent)) {
    return parsed;
  }
  const content = rawContent.map((item) => {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      return {
        type: 'scriptBlock' as const,
        attrs: { elementType: 'action' as const },
        content: [{ type: 'text' as const, text: '' }],
      };
    }
    const b = item as Record<string, unknown>;
    if (b.type !== 'scriptBlock') {
      return {
        type: 'scriptBlock' as const,
        attrs: { elementType: 'action' as const },
        content: [{ type: 'text' as const, text: String(b.text ?? '') }],
      };
    }
    const attrs = b.attrs;
    const elementType =
      attrs &&
      typeof attrs === 'object' &&
      !Array.isArray(attrs) &&
      typeof (attrs as { elementType?: unknown }).elementType === 'string' &&
      VALID_ELEMENT_TYPES.has(
        (attrs as { elementType: string }).elementType.trim().toLowerCase(),
      )
        ? ((attrs as { elementType: string }).elementType
            .trim()
            .toLowerCase() as
            | 'action'
            | 'slugline'
            | 'character'
            | 'parenthetical'
            | 'dialogue'
            | 'transition')
        : ('action' as const);

    let inner = b.content;
    if (!Array.isArray(inner) || inner.length === 0) {
      inner = [{ type: 'text' as const, text: '' }];
    } else {
      inner = inner.map((node) => {
        if (node == null || typeof node !== 'object' || Array.isArray(node)) {
          return { type: 'text' as const, text: '' };
        }
        const n = node as Record<string, unknown>;
        if (n.type === 'text' && typeof n.text === 'string') {
          return { type: 'text' as const, text: n.text };
        }
        return { type: 'text' as const, text: String(n.text ?? '') };
      });
    }
    return {
      type: 'scriptBlock' as const,
      attrs: { elementType },
      content: inner,
    };
  });
  return { ...o, content };
}

async function parseOneChunk(
  groq: Groq,
  params: {
    model: string;
    userMessage: string;
    chunkIndex: number;
    totalChunks: number;
  },
): Promise<{ content: ScreenplayDoc['content']; titleHint?: string | null }> {
  const { model, userMessage, chunkIndex, totalChunks } = params;
  const isFirst = chunkIndex === 0;
  const segmentNote =
    totalChunks > 1
      ? `\n\n[Internal] This is segment ${chunkIndex + 1} of ${totalChunks} of one screenplay. The user message contains only this segment. Do not echo segment numbers, "P1/5", or any part labels in the JSON.`
      : '';
  const system =
    CHUNK_SYSTEM_BASE +
    (totalChunks > 1 && isFirst ? CHUNK_SYSTEM_FIRST : '') +
    (totalChunks > 1 && !isFirst ? CHUNK_SYSTEM_MIDDLE : '') +
    segmentNote;

  const maxTokens = getMaxOutputTokensPerChunk();
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.15,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Empty response from Groq');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Groq returned non-JSON');
  }

  const coerced = normalizeGroqChunkPayload(parsed);
  const validated = groqChunkResponseSchema.safeParse(coerced);
  if (!validated.success) {
    throw new Error(`Invalid chunk JSON from model: ${validated.error.message}`);
  }
  return {
    content: validated.data.content,
    titleHint: validated.data.titleHint,
  };
}

function chunkBackoffMs(attempt: number, err: unknown): number {
  const fromHeader = getRetryAfterMsFromError(err);
  const exponential = RETRY_BASE_MS * 2 ** attempt;
  return Math.max(exponential, fromHeader ?? 0, 1_000);
}

async function parseOneChunkWithRetries(
  groq: Groq,
  input: {
    model: string;
    userMessage: string;
    chunkIndex: number;
    totalChunks: number;
  },
): Promise<{ content: ScreenplayDoc['content']; titleHint?: string | null }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES_PER_CHUNK; attempt++) {
    try {
      return await parseOneChunk(groq, input);
    } catch (e) {
      lastError = e;
      if (!isRetryableGroqHttpError(e)) {
        throw e;
      }
      if (attempt < MAX_RETRIES_PER_CHUNK - 1) {
        const delay = chunkBackoffMs(attempt, e);
        await sleep(delay);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Chunk conversion failed after retries');
}

/** Strip leaked chunk markers (e.g. from older prompts) and fix stuck character+dialogue in one text. */
const SEGMENT_TAG_RE = /\bP\d+\/\d+:\s*/g;

function stripLeakedImportMarkersInBlocks(
  blocks: ScriptBlock[],
): ScriptBlock[] {
  return blocks.map((b) => ({
    ...b,
    content: b.content.map((n) => ({
      ...n,
      text:
        typeof n.text === 'string'
          ? n.text
              .replace(SEGMENT_TAG_RE, '')
              .replace(/^\s*P\d+\/\d+:\s*/gm, '')
          : n.text,
    })),
  }));
}

/**
 * If the model put "CLAIRE" and "Why…" in one character block, split at TitleCase word start.
 */
function splitStuckCharacterNameAndDialogue(
  blocks: ScriptBlock[],
): ScriptBlock[] {
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
    if (splitAt < 0) {
      out.push(b);
      continue;
    }
    const namePart = t.slice(0, splitAt).trim();
    const rest = t.slice(splitAt).trim();
    if (!namePart || !rest) {
      out.push(b);
      continue;
    }
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

/**
 * Chunks the extracted plain text, runs one JSON-validated conversion per chunk (with retries on
 * parse/validate/API failure), then merges into a full TipTap doc.
 */
export async function parseScreenplayWithGroq(params: {
  /** Plain text only; must not be a buffer, base64, or binary. */
  plainText: string;
  pageCount: number;
  apiKey: string;
  model: string;
}): Promise<ParseScreenplayWithGroqResult> {
  const { plainText, pageCount, apiKey, model } = params;
  const maxChunkChars = getMaxChunkChars();
  const maxOut = getMaxOutputTokensPerChunk();
  logPreflightTpmIfRisky(maxChunkChars, maxOut);

  const rawSlice =
    plainText.length > MAX_PLAINTEXT_CHARS
      ? plainText.slice(0, MAX_PLAINTEXT_CHARS)
      : plainText;
  const trimmed = normalizeScreenplayPlainText(rawSlice);

  if (!trimmed.trim()) {
    throw new Error('No extractable text in PDF');
  }

  const groq = new Groq({ apiKey });
  const chunkTexts = buildPlainTextChunks(trimmed, maxChunkChars);
  if (chunkTexts.length === 0) {
    throw new Error('No text chunks to convert');
  }

  const allBlocks: ScreenplayDoc['content'] = [];
  let titleHint: string | null = null;
  const total = chunkTexts.length;
  const interDelay = getChunkInterDelayMs();

  for (let i = 0; i < total; i += 1) {
    if (i > 0 && interDelay > 0) {
      await sleep(interDelay);
    }
    const segment = chunkTexts[i]!;
    // Segment index lives in the system prompt only; prefixing the user text with "P1/5:" leaked
    // into saved screenplay. User message = raw segment only.
    const userMessage = segment;
    if (typeof userMessage !== 'string') {
      throw new Error('Internal error: user message to Groq must be plain string text');
    }

    const { content, titleHint: th } = await parseOneChunkWithRetries(groq, {
      model,
      userMessage,
      chunkIndex: i,
      totalChunks: total,
    });
    for (const b of content) {
      allBlocks.push(b);
    }
    if (i === 0 && th !== undefined && th !== null) {
      const t = String(th).trim();
      if (t) titleHint = t;
    }
  }

  if (allBlocks.length === 0) {
    throw new Error('Model produced no script blocks for this screenplay');
  }

  const blocksSanitized = splitStuckCharacterNameAndDialogue(
    stripLeakedImportMarkersInBlocks(allBlocks),
  );
  const doc: ScreenplayDoc = { type: 'doc', content: blocksSanitized };
  screenplayDocSchema.parse(doc);
  const { characters, scenes } = entitiesFromDoc(doc);

  return {
    doc,
    pageCount,
    titleHint,
    characters,
    scenes,
  };
}

/**
 * End-to-end: buffer → pdf-parse text → Groq in chunks → merged doc. The LLM never sees the PDF buffer.
 */
export async function importScreenplayFromPdfBuffer(
  fileBuffer: Buffer,
  options: { apiKey: string; model: string },
): Promise<ParseScreenplayWithGroqResult> {
  const { text, pageCount } = await extractScriptPlainTextFromPdf(fileBuffer);
  if (!text.trim()) {
    throw new Error('No extractable text (scanned PDF?). Use a text-based PDF.');
  }
  return parseScreenplayWithGroq({
    plainText: text,
    pageCount,
    apiKey: options.apiKey,
    model: options.model,
  });
}
