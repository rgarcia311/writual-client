import Groq from 'groq-sdk';
import { groqImportResponseSchema, type ScreenplayDoc } from './screenplaySchema';
import { entitiesFromDoc, type ImportCharacter, type ImportScene } from './entitiesFromDoc';

const MAX_CHARS = 200_000;

const SYSTEM_PROMPT = `You convert screenplay plain text (from a PDF) into structured JSON for a TipTap editor.

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

export interface ParseScreenplayResult {
  doc: ScreenplayDoc;
  pageCount: number;
  titleHint: string | null;
  characters: ImportCharacter[];
  scenes: ImportScene[];
}

export async function groqParseScreenplay(params: {
  plainText: string;
  pageCount: number;
  apiKey: string;
  model: string;
}): Promise<ParseScreenplayResult> {
  const { plainText, pageCount, apiKey, model } = params;
  const trimmed =
    plainText.length > MAX_CHARS
      ? plainText.slice(0, MAX_CHARS)
      : plainText;

  if (!trimmed.trim()) {
    throw new Error('No extractable text in PDF');
  }

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.15,
    max_tokens: 32_768,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Screenplay plain text follows.\n\n${trimmed}`,
      },
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
