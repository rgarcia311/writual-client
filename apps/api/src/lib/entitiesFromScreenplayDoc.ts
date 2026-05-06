/**
 * Mirrors `apps/writual-ai/src/entitiesFromDoc.ts` + scene body serialization for enrichment.
 * Keep logic aligned when changing outline derivation rules.
 */

const CONT_RE = /\(CONT['']D\)/gi;

export interface OutlineSceneForEnrichment {
  index: number;
  sceneHeading: string;
  synopsis?: string;
  scenePlainText: string;
}

export interface DialogueCueCharacter {
  name: string;
}

function stripCueNoise(raw: string): string {
  return raw
    .replace(CONT_RE, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function blockText(block: Record<string, unknown>): string {
  const content = block.content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const n of content) {
    if (
      n &&
      typeof n === 'object' &&
      !Array.isArray(n) &&
      (n as { type?: unknown }).type === 'text' &&
      typeof (n as { text?: unknown }).text === 'string'
    ) {
      out += (n as { text: string }).text;
    }
  }
  return out;
}

/**
 * Validates minimal TipTap screenplay doc shape; returns empty derivation on malformed input.
 */
export function extractDialogueCueCharacters(doc: unknown): DialogueCueCharacter[] {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return [];
  }
  const content = (doc as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return [];
  }

  const characterNames = new Map<string, string>();

  for (const block of content) {
    if (block === null || typeof block !== 'object' || Array.isArray(block)) continue;
    const b = block as Record<string, unknown>;
    if (b.type !== 'scriptBlock') continue;
    const attrs = b.attrs;
    if (!attrs || typeof attrs !== 'object' || attrs === null) continue;
    if ((attrs as { elementType?: unknown }).elementType !== 'character') continue;
    const text = blockText(b).trim();
    if (!text) continue;
    const name = stripCueNoise(text);
    if (!name) continue;
    const key = name.toUpperCase();
    if (!characterNames.has(key)) characterNames.set(key, name);
  }

  return [...characterNames.values()].map((name) => ({ name }));
}

/**
 * Scene headings + opening action synopsis (contiguous `action` blocks after slugline), plus full scene text for AI.
 */
export function extractOutlineScenesForEnrichment(doc: unknown): OutlineSceneForEnrichment[] {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return [];
  }
  const content = (doc as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return [];
  }

  const blocks = content.filter(
    (b): b is Record<string, unknown> =>
      b !== null && typeof b === 'object' && !Array.isArray(b),
  );

  const sluglineIndices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.type !== 'scriptBlock') continue;
    const attrs = b.attrs;
    if (!attrs || typeof attrs !== 'object') continue;
    if ((attrs as { elementType?: unknown }).elementType === 'slugline') {
      sluglineIndices.push(i);
    }
  }

  const out: OutlineSceneForEnrichment[] = [];

  for (let si = 0; si < sluglineIndices.length; si++) {
    const i = sluglineIndices[si]!;
    const sceneHeading = blockText(blocks[i]!).trim();
    if (!sceneHeading) continue;

    const synopsisParts: string[] = [];
    let j = i + 1;
    while (j < blocks.length) {
      const next = blocks[j]!;
      if (next.type !== 'scriptBlock') break;
      const attrs = next.attrs;
      const et =
        attrs && typeof attrs === 'object' && attrs !== null
          ? (attrs as { elementType?: unknown }).elementType
          : undefined;
      if (et !== 'action') break;
      const t = blockText(next).trim();
      if (t) synopsisParts.push(t);
      j++;
    }

    const synopsis =
      synopsisParts.length > 0 ? synopsisParts.join('\n') : undefined;

    const sceneEndExclusive =
      si + 1 < sluglineIndices.length ? sluglineIndices[si + 1] : blocks.length;
    const bodyParts: string[] = [];
    for (let k = i; k < sceneEndExclusive; k++) {
      const b = blocks[k]!;
      if (b.type !== 'scriptBlock') continue;
      const t = blockText(b).trim();
      if (t) bodyParts.push(t);
    }
    const scenePlainText = bodyParts.join('\n\n');

    out.push({
      index: out.length,
      sceneHeading,
      synopsis,
      scenePlainText,
    });
  }

  return out;
}
