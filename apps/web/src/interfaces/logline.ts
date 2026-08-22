/** One piece of feedback on a logline version, attributed to the user who wrote it. */
export interface LoglineFeedback {
  _id: string;
  authorUid: string;
  authorName: string;
  text: string;
  createdAt: string | null;
}

/** One iteration of the project logline; the `current` entry mirrors `project.logline`. */
export interface LoglineVersion {
  _id: string;
  text: string;
  authorUid: string | null;
  authorName: string;
  current: boolean;
  feedback: LoglineFeedback[];
  createdAt: string | null;
}

function toFeedback(raw: Record<string, unknown>): LoglineFeedback {
  return {
    _id: String(raw?._id ?? ''),
    authorUid: String(raw?.authorUid ?? ''),
    authorName: String(raw?.authorName ?? '').trim(),
    text: String(raw?.text ?? ''),
    createdAt: raw?.createdAt != null ? String(raw.createdAt) : null,
  };
}

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normalizes a `loglineHistory` payload: newest first, with exactly one entry marked current.
 * A partially applied write can leave several entries (or none) flagged, so the newest flagged
 * entry wins — falling back to the newest entry overall.
 */
export function normalizeLoglineHistory(raw: unknown): LoglineVersion[] {
  if (!Array.isArray(raw)) return [];

  const rows = raw
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => ({
      _id: String(row._id ?? ''),
      text: String(row.text ?? ''),
      authorUid: row.authorUid != null ? String(row.authorUid) : null,
      authorName: String(row.authorName ?? '').trim(),
      current: Boolean(row.current),
      feedback: Array.isArray(row.feedback)
        ? (row.feedback as Array<Record<string, unknown>>).filter(Boolean).map(toFeedback)
        : [],
      createdAt: row.createdAt != null ? String(row.createdAt) : null,
    }))
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

  const currentId = (rows.find((row) => row.current) ?? rows[0])?._id ?? '';
  return rows.map((row) => ({ ...row, current: row._id === currentId }));
}
