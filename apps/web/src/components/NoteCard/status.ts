import type { Note } from './types';

/**
 * The three buckets a note can sit in. Stored as two booleans rather than one field
 * (`shouldIncorporate` / `incorporated`) — `shouldIncorporate: false` is the "Maybe"
 * bucket, i.e. kept around but not committed to the story.
 */
export type NoteStatus = 'todo' | 'maybe' | 'incorporated';

export const NOTE_STATUS_ORDER: NoteStatus[] = ['todo', 'maybe', 'incorporated'];

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  todo: 'To incorporate',
  maybe: 'Maybe',
  incorporated: 'Incorporated',
};

/** Tooltip copy for the card's status control — phrased as the move it performs. */
export const NOTE_STATUS_ACTIONS: Record<NoteStatus, string> = {
  todo: 'Move to To incorporate',
  maybe: 'Move to Maybe',
  incorporated: 'Move to Incorporated',
};

export const NOTE_STATUS_COLORS: Record<NoteStatus, 'warning' | 'info' | 'success'> = {
  todo: 'warning',
  maybe: 'info',
  incorporated: 'success',
};

export function getNoteStatus(note: Pick<Note, 'incorporated' | 'shouldIncorporate'>): NoteStatus {
  if (!note.shouldIncorporate) return 'maybe';
  return note.incorporated ? 'incorporated' : 'todo';
}

/** The stored flag pair for a status, for use as a mutation payload. */
export function noteStatusFlags(status: NoteStatus): {
  incorporated: boolean;
  shouldIncorporate: boolean;
} {
  if (status === 'maybe') return { shouldIncorporate: false, incorporated: false };
  return { shouldIncorporate: true, incorporated: status === 'incorporated' };
}
