import { getSluglineLocation } from '@/components/ScreenplayEditor/screenplaySluglineUtils';

const CONT_RE = /\(CONT['']D\)/gi;

function stripCueNoise(raw: string): string {
  return raw
    .replace(CONT_RE, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function blockTextFromJson(block: Record<string, unknown>): string {
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

function scriptBlocks(doc: unknown): Record<string, unknown>[] {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return [];
  const content = (doc as { content?: unknown }).content;
  if (!Array.isArray(content)) return [];
  return content.filter(
    (b): b is Record<string, unknown> =>
      b !== null && typeof b === 'object' && !Array.isArray(b) && (b as { type?: unknown }).type === 'scriptBlock',
  );
}

function sluglineIndices(blocks: Record<string, unknown>[]): number[] {
  const out: number[] = [];
  blocks.forEach((b, idx) => {
    const attrs = b.attrs as { elementType?: unknown } | undefined;
    if (attrs?.elementType === 'slugline') out.push(idx);
  });
  return out;
}

function blockHasAlts(block: Record<string, unknown>): boolean {
  const attrs = block.attrs as { versions?: unknown } | undefined;
  return Array.isArray(attrs?.versions) && attrs!.versions.length > 1;
}

export interface SceneHeadingSlice {
  /** Short heading shown in lists */
  heading: string;
  /** INT / EXT / I_E / OTHER */
  location: ReturnType<typeof getSluglineLocation>;
}

export interface DerivedScreenplayPresence {
  intSceneWeight: number;
  extSceneWeight: number;
  scenes: SceneHeadingSlice[];
  scenesWithAlts: { heading: string }[];
  characterSceneCounts: Array<{ normalized: string; display: string; sceneCount: number }>;
}

/**
 * Parses screenplay TipTap JSON: INT/EXT weighting (I/E counts 0.5 each),
 * scenes with any block alternatives, dialogue character scene presence matched to roster names.
 */
export function deriveScreenplayPresenceStats(
  doc: unknown,
  rosterNames: readonly string[],
): DerivedScreenplayPresence {
  const blocks = scriptBlocks(doc);
  const slugIdx = sluglineIndices(blocks);
  const rosterUpper = rosterNames.map((n) => n.trim()).filter(Boolean);
  const rosterKeys = rosterUpper.map((n) => n.toUpperCase());

  const scenes: SceneHeadingSlice[] = [];
  const scenesWithAlts: { heading: string }[] = [];

  /** sceneIndex -> normalized character names appearing in dialogue cues */
  const sceneCharacters = new Map<number, Set<string>>();

  for (let si = 0; si < slugIdx.length; si++) {
    const start = slugIdx[si]!;
    const heading = blockTextFromJson(blocks[start]!).trim() || '(Untitled scene)';
    const loc = getSluglineLocation(heading);
    scenes.push({ heading, location: loc });

    const sceneEndExclusive = si + 1 < slugIdx.length ? slugIdx[si + 1]! : blocks.length;

    let hasAlt = false;
    for (let k = start; k < sceneEndExclusive; k++) {
      const b = blocks[k]!;
      if (blockHasAlts(b)) hasAlt = true;
      const attrs = b.attrs as { elementType?: unknown } | undefined;
      if (attrs?.elementType !== 'character') continue;
      const raw = stripCueNoise(blockTextFromJson(b)).trim().toUpperCase();
      if (!raw) continue;
      if (!sceneCharacters.has(si)) sceneCharacters.set(si, new Set());
      rosterKeys.forEach((key, rosterI) => {
        if (!key) return;
        if (raw.includes(key)) {
          const display = rosterUpper[rosterI]!;
          sceneCharacters.get(si)!.add(`${key}|||${display}`);
        }
      });
    }
    if (hasAlt) scenesWithAlts.push({ heading });
  }

  let intSceneWeight = 0;
  let extSceneWeight = 0;
  for (const s of scenes) {
    if (s.location === 'INT') intSceneWeight += 1;
    else if (s.location === 'EXT') extSceneWeight += 1;
    else if (s.location === 'I_E') {
      intSceneWeight += 0.5;
      extSceneWeight += 0.5;
    }
  }

  const scenePresence = new Map<string, number>();
  rosterKeys.forEach((k) => scenePresence.set(k, 0));
  sceneCharacters.forEach((names) => {
    names.forEach((combined) => {
      const [key] = combined.split('|||');
      if (!key) return;
      scenePresence.set(key, (scenePresence.get(key) ?? 0) + 1);
    });
  });

  const characterSceneCounts = rosterUpper.map((display, idx) => {
    const ku = rosterKeys[idx]!;
    return {
      normalized: ku,
      display,
      sceneCount: scenePresence.get(ku) ?? 0,
    };
  });

  return {
    intSceneWeight,
    extSceneWeight,
    scenes,
    scenesWithAlts,
    characterSceneCounts,
  };
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function calendarDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Synthetic Mon–Sun dual-bar heights (absolute units; normalize in the chart with row max). */
export function estimateWeekWritingBarRatios(now: Date, pagesPerDay: number | null): {
  label: string;
  draft: number;
  pace: number;
  projected: boolean;
}[] {
  const base =
    typeof pagesPerDay === 'number' && Number.isFinite(pagesPerDay) && pagesPerDay > 0
      ? pagesPerDay
      : 5;
  const weekStart = startOfWeekMonday(now);
  const todayMs = calendarDayMs(now);

  return WEEKDAY_SHORT.map((label, i) => {
    const dayMs = calendarDayMs(
      new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i),
    );
    const projected = dayMs > todayMs;

    const pace = Math.max(8, base * (0.88 + i * 0.025));
    const draft = projected
      ? base * (0.28 + i * 0.04)
      : Math.min(base * 1.4, base * (0.62 + i * 0.06 + (i % 2 === 0 ? 0.08 : 0)));

    return { label, draft, pace, projected };
  });
}
