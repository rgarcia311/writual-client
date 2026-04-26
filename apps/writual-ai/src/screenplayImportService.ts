import type { Buffer } from 'node:buffer';
import Groq from 'groq-sdk';
import { groqImportResponseSchema, type ScreenplayDoc } from './screenplaySchema';
import {
  entitiesFromDoc,
  type ImportCharacter,
  type ImportScene,
} from './entitiesFromDoc';

/**
 * Free-tier Groq TPM is enforced as Input tokens + max_tokens before a completion runs.
 * Keep this low so 5+ page screenplays (input) + reserved output stay under typical caps.
 * @see https://console.groq.com/docs/rate-limits
 */
const GROQ_MAX_OUTPUT_TOKENS = 2500;

/** Hard cap on characters sent to the model (defensive; PDF text is already bounded by page count). */
const MAX_PLAINTEXT_CHARS = 200_000;

// pdf-parse is CommonJS; keep require for node/ts compatibility.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{
  numpages: number;
  text: string;
}>;

const SYSTEM_PROMPT = `You convert screenplay plain text (from a PDF) into structured JSON for a TipTap editor.

The ONLY content in the user message is the extracted plain-text of the PDF — no file names, no base64, no binary, no metadata. Treat the entire user message as the screenplay.

Output a single JSON object with keys:
- "doc": { "type": "doc", "content": [ ... ] }
- "titleHint": string or null (guess from title page if obvious, else null)

Each item in "content" is a scriptBlock:
{ "type": "scriptBlock", "attrs": { "elementType": "<type>" }, "content": [{ "type": "text", "text": "..." }] }

elementType must be one of: action, slugline, character, parenthetical, dialogue, transition.

Rules:
- slugline: scene headings (INT., EXT., INT/EXT, I/E., etc.).
- character: CHARACTER NAME cues in all caps (may include (CONT'D) or V.O./O.S. in the text).
- parenthetical: wrylies starting with (
- dialogue: spoken lines under a character cue
- transition: CUT TO:, FADE OUT., etc.
- action: scene description, everything else
- Merge consecutive lines of the SAME elementType into one scriptBlock (use newline inside action; space for dialogue continuation).
- Preserve paragraph breaks as separate action blocks when appropriate.
- Do not include JSON outside the object. No markdown.`;

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
  const text = raw.replace(/\0/g, '').replace(/\r\n/g, '\n').trim();
  const pageCount = typeof data.numpages === 'number' && data.numpages >= 0 ? data.numpages : 0;
  return { text, pageCount };
}

/**
 * Step 2: send ONLY the clean screenplay string to Groq (the user `content` is that string and nothing else).
 */
export async function parseScreenplayWithGroq(params: {
  /** Plain text only; must not be a buffer, base64, or binary. */
  plainText: string;
  pageCount: number;
  apiKey: string;
  model: string;
}): Promise<ParseScreenplayWithGroqResult> {
  const { plainText, pageCount, apiKey, model } = params;
  const trimmed =
    plainText.length > MAX_PLAINTEXT_CHARS
      ? plainText.slice(0, MAX_PLAINTEXT_CHARS)
      : plainText;

  if (!trimmed.trim()) {
    throw new Error('No extractable text in PDF');
  }

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.15,
    max_tokens: GROQ_MAX_OUTPUT_TOKENS,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: trimmed },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('Empty response from Groq');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Groq returned non-JSON');
  }

  const validated = groqImportResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid screenplay JSON from model: ${validated.error.message}`);
  }

  const { doc, titleHint } = validated.data;
  const { characters, scenes } = entitiesFromDoc(doc);

  return {
    doc,
    pageCount,
    titleHint: titleHint ?? null,
    characters,
    scenes,
  };
}

/**
 * End-to-end: buffer → pdf-parse text → Groq with capped max_tokens. The LLM never sees the PDF buffer.
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
