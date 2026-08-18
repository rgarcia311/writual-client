import type { WritingTracker } from '../interfaces/project';

export type ProgressStatus = 'empty' | 'partial' | 'complete';

export interface ProgressItem {
  label: string;
  status: ProgressStatus;
}

interface ProjectForProgress {
  title?: string | null;
  logline?: string | null;
  genre?: string | null;
  type?: string | null;
  activeVersion?: number | null;
  lockedVersion?: number | null;
  // Optional arrays for fallback when stats are missing or not backfilled
  characters?: Array<{ lockedVersion?: number | null }> | null;
  scenes?: Array<{ lockedVersion?: number | null }> | null;
  stats?: {
    totalScenes?: number;
    lockedScenes?: number;
    totalCharacters?: number;
    lockedCharacters?: number;
  } | null;
  screenplay?: {
    lockedVersion?: number | null;
    versions?: Array<{ version?: number }> | null;
  } | null;
}

/** Character / outline roster totals plus their per-item and whole-section lock state. */
export interface DevelopmentLockSummary {
  totalCharacters: number;
  lockedCharacters: number;
  /** `charactersSectionLocked`: no characters can be added or deleted. */
  charactersSectionLocked: boolean;
  totalScenes: number;
  lockedScenes: number;
  /** `outlineSectionLocked`: no scenes can be added or deleted. */
  outlineSectionLocked: boolean;
}

type ProjectForDevelopmentLocks = ProjectForProgress & {
  charactersSectionLocked?: boolean | null;
  outlineSectionLocked?: boolean | null;
};

/**
 * Character and outline-scene counts for the progress tile. Prefers the project's `stats` counters
 * and falls back to the roster arrays for projects whose counters were never backfilled.
 */
export function computeDevelopmentLockSummary(
  project: ProjectForDevelopmentLocks | null | undefined
): DevelopmentLockSummary {
  const stats = project?.stats ?? {};
  const characters = Array.isArray(project?.characters) ? project!.characters! : [];
  const scenes = Array.isArray(project?.scenes) ? project!.scenes! : [];

  return {
    totalCharacters: stats.totalCharacters ?? characters.length,
    lockedCharacters:
      stats.lockedCharacters ?? characters.filter((c) => c?.lockedVersion != null).length,
    charactersSectionLocked: Boolean(project?.charactersSectionLocked),
    totalScenes: stats.totalScenes ?? scenes.length,
    lockedScenes: stats.lockedScenes ?? scenes.filter((s) => s?.lockedVersion != null).length,
    outlineSectionLocked: Boolean(project?.outlineSectionLocked),
  };
}

/**
 * Computes the progress items for the project card from dashboard project data.
 * Uses stats and version/lock flags only (no full scenes/characters).
 */
export function computeProjectProgress(project: ProjectForProgress | null | undefined): ProgressItem[] {
  if (!project) {
    return [
      { label: 'Title', status: 'empty' },
      { label: 'Logline', status: 'empty' },
      { label: 'Genre', status: 'empty' },
      { label: 'Type', status: 'empty' },
      { label: 'Characters', status: 'empty' },
      { label: 'Outline', status: 'empty' },
      { label: 'Screenplay', status: 'empty' },
    ];
  }

  const stats = project.stats ?? {};
  const characters = Array.isArray(project.characters) ? project.characters : [];
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];

  const inferredTotalCharacters = characters.length;
  const inferredLockedCharacters = characters.filter((c: any) => c?.lockedVersion != null).length;
  const inferredTotalScenes = scenes.length;
  const inferredLockedScenes = scenes.filter((s: any) => s?.lockedVersion != null).length;

  const totalScenes = stats.totalScenes ?? inferredTotalScenes;
  const lockedScenes = stats.lockedScenes ?? inferredLockedScenes;
  const totalCharacters = stats.totalCharacters ?? inferredTotalCharacters;
  const lockedCharacters = stats.lockedCharacters ?? inferredLockedCharacters;
  const activeVersion = project.activeVersion ?? 1;
  const lockedVersion = project.lockedVersion ?? null;

  const projectMetaLocked =
    lockedVersion != null && activeVersion != null && lockedVersion === activeVersion;

  /** Title/logline/genre/type all complete together — they lock with the project's meta version. */
  const metaFieldStatus = (value: string | null | undefined): ProgressStatus => {
    if (!(value ?? '').trim()) return 'empty';
    return projectMetaLocked ? 'complete' : 'partial';
  };

  const titleStatus = metaFieldStatus(project.title);
  const loglineStatus = metaFieldStatus(project.logline);
  const genreStatus = metaFieldStatus(project.genre);
  const typeStatus = metaFieldStatus(project.type);

  const charactersStatus: ProgressStatus =
    totalCharacters === 0
      ? 'empty'
      : lockedCharacters === totalCharacters
        ? 'complete'
        : 'partial';

  const outlineStatus: ProgressStatus =
    totalScenes === 0
      ? 'empty'
      : lockedScenes === totalScenes
        ? 'complete'
        : 'partial';

  const screenplayVersions = project.screenplay?.versions ?? [];
  const screenplayHasContent = screenplayVersions.length > 0;
  const screenplayLocked = project.screenplay?.lockedVersion != null;
  const screenplayStatus: ProgressStatus = !screenplayHasContent
    ? 'empty'
    : screenplayLocked
      ? 'complete'
      : 'partial';

  return [
    { label: 'Title', status: titleStatus },
    { label: 'Logline', status: loglineStatus },
    { label: 'Genre', status: genreStatus },
    { label: 'Type', status: typeStatus },
    { label: 'Characters', status: charactersStatus },
    { label: 'Outline', status: outlineStatus },
    { label: 'Screenplay', status: screenplayStatus },
  ];
}

export type TrackerScheduleStatus = 'ahead' | 'on_track' | 'behind' | 'no_data';

export interface WritingTrackerStatus {
  resolvedCurrentPages: number;
  pagesPerDay: number | null;
  scheduleStatus: TrackerScheduleStatus;
  nextDueDraftLabel: string | null;
  nextDueDraftDate: string | null;
  daysUntilNextDue: number | null;
  pageProgressPercent: number | null;
}

function localToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.round(
    (new Date(isoB).getTime() - new Date(isoA).getTime()) / (1000 * 60 * 60 * 24)
  );
}

/** Human-readable duration for tracker UI: day(s), week(s), or month(s). */
function trackerDurationPhrase(wholeDays: number): string {
  const d = Math.max(0, Math.round(wholeDays));
  if (d < 7) {
    return d === 1 ? '1 day' : `${d} days`;
  }
  if (d < 60) {
    const w = Math.max(1, Math.round(d / 7));
    return w === 1 ? '1 week' : `${w} weeks`;
  }
  const m = Math.max(1, Math.round(d / 30));
  return m === 1 ? '1 month' : `${m} months`;
}

/**
 * Relative copy for the next draft deadline (e.g. "in 2 weeks", "due today", "overdue by 1 day").
 */
export function formatWritingTrackerRelativeDeadline(daysUntilNextDue: number): string {
  if (daysUntilNextDue < 0) {
    return `overdue by ${trackerDurationPhrase(-daysUntilNextDue)}`;
  }
  if (daysUntilNextDue === 0) {
    return 'due today';
  }
  return `in ${trackerDurationPhrase(daysUntilNextDue)}`;
}

const trackerDueDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

/** Localized display string for an ISO calendar date (YYYY-MM-DD). */
export function formatWritingTrackerDueDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const [y, m, day] = parts;
  if (![y, m, day].every((n) => Number.isFinite(n))) return isoDate;
  const localized = trackerDueDateFormatter.format(new Date(y, m - 1, day));
  return localized;
}

/** Compact ISO display (YYYY-MM-DD) for small tracker UI; falls back to raw on bad input. */
export function formatWritingTrackerDueDateIso(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  const [y, m, day] = parts;
  if (![y, m, day].every((n) => Number.isFinite(n))) return isoDate;
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Short relative phrase for tight stat tiles: "due in 4d", "due today", "overdue 2d".
 * Uses Math.abs for negative offsets (never "overdue -2d").
 */
export function formatWritingTrackerRelativeDeadlineShort(daysUntilNextDue: number): string {
  const d = Math.round(daysUntilNextDue);
  if (d < 0) {
    const overdue = Math.abs(d);
    if (overdue < 7) {
      return overdue === 1 ? 'overdue 1d' : `overdue ${overdue}d`;
    }
    const w = Math.max(1, Math.round(overdue / 7));
    return w === 1 ? 'overdue 1w' : `overdue ${w}w`;
  }
  if (d === 0) {
    return 'due today';
  }
  if (d < 7) {
    return d === 1 ? 'due in 1d' : `due in ${d}d`;
  }
  if (d < 60) {
    const w = Math.max(1, Math.round(d / 7));
    return w === 1 ? 'due in 1w' : `due in ${w}w`;
  }
  const m = Math.max(1, Math.round(d / 30));
  return m === 1 ? 'due in 1mo' : `due in ${m}mo`;
}

/** One draft deadline, resolved against today for display on the Deadline Tracking tile. */
export interface DraftDeadline {
  draftNumber: number;
  label: string;
  tag: string | null;
  dueDate: string;
  /** Whole days from today; negative once the date has passed. */
  daysUntil: number;
  /** Earliest deadline still ahead — the one the writer is working toward. */
  isNext: boolean;
  isPast: boolean;
}

/** Draft deadlines in date order, with the next one flagged. Empty when tracking is off. */
export function computeDraftDeadlines(
  tracker: WritingTracker | null | undefined
): DraftDeadline[] {
  if (!tracker?.enabled) return [];

  const today = localToday();
  const sorted = [...(tracker.draftDueDates ?? [])]
    .filter((d) => Boolean(d?.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const nextIndex = sorted.findIndex((d) => d.dueDate >= today);

  return sorted.map((d, i) => ({
    draftNumber: d.draftNumber ?? i + 1,
    label: d.label,
    tag: d.tag ?? null,
    dueDate: d.dueDate,
    daysUntil: daysBetween(today, d.dueDate),
    isNext: i === nextIndex,
    isPast: d.dueDate < today,
  }));
}

export function computeWritingTrackerStatus(
  tracker: WritingTracker | null | undefined,
  opts?: { liveEditorBodyPages?: number | null }
): WritingTrackerStatus {
  const empty: WritingTrackerStatus = {
    resolvedCurrentPages: 0,
    pagesPerDay: null,
    scheduleStatus: 'no_data',
    nextDueDraftLabel: null,
    nextDueDraftDate: null,
    daysUntilNextDue: null,
    pageProgressPercent: null,
  };

  if (!tracker?.enabled) return empty;

  const today = localToday();
  const startDate = tracker.trackingStartDate ?? today;
  const persistedPages = tracker.currentPageCount ?? 0;
  const live = opts?.liveEditorBodyPages;
  const liveOk =
    live != null &&
    typeof live === 'number' &&
    Number.isFinite(live) &&
    live >= 1;
  const currentPages = liveOk ? Math.max(persistedPages, Math.round(live)) : persistedPages;
  const targetPages = tracker.targetPageCount ?? 0;

  const daysElapsed = Math.max(1, daysBetween(startDate, today));
  const pagesPerDay = Number((currentPages / daysElapsed).toFixed(1));
  const pageProgressPercent =
    targetPages > 0 ? Math.min(100, Math.round((currentPages / targetPages) * 100)) : null;

  const sorted = [...(tracker.draftDueDates ?? [])]
    .filter((d) => Boolean(d.dueDate))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const upcoming = sorted.find((d) => d.dueDate >= today) ?? sorted[sorted.length - 1] ?? null;

  if (!upcoming || targetPages === 0) {
    return {
      ...empty,
      resolvedCurrentPages: currentPages,
      pagesPerDay,
      pageProgressPercent,
    };
  }

  const daysUntilNextDue = daysBetween(today, upcoming.dueDate);
  const totalDays = Math.max(1, daysBetween(startDate, upcoming.dueDate));
  const expectedByNow = targetPages * (daysElapsed / totalDays);

  let scheduleStatus: TrackerScheduleStatus;
  if (currentPages >= expectedByNow) {
    scheduleStatus = 'ahead';
  } else if (currentPages >= expectedByNow * 0.85) {
    scheduleStatus = 'on_track';
  } else {
    scheduleStatus = 'behind';
  }

  return {
    resolvedCurrentPages: currentPages,
    pagesPerDay,
    scheduleStatus,
    nextDueDraftLabel: upcoming.label,
    nextDueDraftDate: upcoming.dueDate,
    daysUntilNextDue,
    pageProgressPercent,
  };
}
