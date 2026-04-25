import type { ScreenplayDoc } from './screenplaySchema';

export interface ImportCharacter {
  name: string;
}

export interface ImportScene {
  sceneHeading: string;
  synopsis?: string;
}

const CONT_RE = /\(CONT['']D\)/gi;

function stripCueNoise(raw: string): string {
  return raw
    .replace(CONT_RE, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Derives outline scenes and character cues from the TipTap screenplay doc
 * so DB rows stay consistent with the saved editor content.
 */
export function entitiesFromDoc(doc: ScreenplayDoc): {
  characters: ImportCharacter[];
  scenes: ImportScene[];
} {
  const blocks = doc.content ?? [];
  const characterNames = new Map<string, string>();

  for (const block of blocks) {
    if (block.type !== 'scriptBlock') continue;
    if (block.attrs?.elementType !== 'character') continue;
    const text = (block.content[0]?.text ?? '').trim();
    if (!text) continue;
    const name = stripCueNoise(text);
    if (name) {
      const key = name.toUpperCase();
      if (!characterNames.has(key)) characterNames.set(key, name);
    }
  }

  const scenes: ImportScene[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type !== 'scriptBlock') continue;
    if (block.attrs?.elementType !== 'slugline') continue;

    const sceneHeading = (block.content[0]?.text ?? '').trim();
    if (!sceneHeading) continue;

    const synopsisParts: string[] = [];
    let j = i + 1;
    while (j < blocks.length) {
      const next = blocks[j];
      if (next.type !== 'scriptBlock') break;
      const et = next.attrs?.elementType;
      if (et !== 'action') break;
      const t = (next.content[0]?.text ?? '').trim();
      if (t) synopsisParts.push(t);
      j++;
    }

    const synopsis =
      synopsisParts.length > 0 ? synopsisParts.join('\n') : undefined;
    scenes.push({ sceneHeading, synopsis });
  }

  return {
    characters: [...characterNames.values()].map((name) => ({ name })),
    scenes,
  };
}
