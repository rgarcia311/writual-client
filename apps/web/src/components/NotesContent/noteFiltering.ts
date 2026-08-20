import { getNoteStatus, type AssociationTarget, type Note, type NoteStatus } from '@/components/NoteCard';

export type NoteStatusFilter = 'all' | NoteStatus;
export type NoteSortMode = 'newest' | 'oldest' | 'title' | 'association';

export const ALL_CATEGORIES = '__all__';
/** Sentinel values for the association picker, kept out of the _id namespace. */
export const ALL_ASSOCIATIONS = '__all_associations__';
export const GENERAL_ASSOCIATION = '__general__';

export const STATUS_FILTER_OPTIONS: Array<{ value: NoteStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To incorporate' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'incorporated', label: 'Incorporated' },
];

export const SORT_OPTIONS: Array<{ value: NoteSortMode; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'association', label: 'Association' },
];

export interface NoteFilters {
  status: NoteStatusFilter;
  category: string;
  /** An association target _id, or one of the ALL_/GENERAL_ sentinels. */
  association: string;
}

/** True when `note` passes the status, category and association filters. */
export function matchesNoteFilters(note: Note, filters: NoteFilters): boolean {
  if (filters.category !== ALL_CATEGORIES && note.category.trim() !== filters.category) return false;
  if (filters.status !== 'all' && getNoteStatus(note) !== filters.status) return false;
  if (filters.association === GENERAL_ASSOCIATION) return note.association.kind === 'none';
  if (filters.association !== ALL_ASSOCIATIONS) {
    return note.association.targetId === filters.association;
  }
  return true;
}

/** Grouping order when sorting by association; unassociated notes sink to the bottom. */
const KIND_RANK: Record<string, number> = { character: 0, scene: 1, inspiration: 2, none: 3 };

function timestamp(note: Note): number {
  const value = note.updatedAt ?? note.createdAt;
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Ordering key within an association group: scenes go by scene number, everything else
 * alphabetically by the target's label so characters and inspiration read A–Z.
 */
function associationRank(
  note: Note,
  targetsById: Map<string, AssociationTarget>
): { kind: number; number: number; label: string } {
  const kind = KIND_RANK[note.association.kind] ?? KIND_RANK.none;
  if (note.association.kind === 'none') return { kind, number: 0, label: '' };
  const target = note.association.targetId ? targetsById.get(note.association.targetId) : undefined;
  const label = (target?.label ?? note.association.label ?? '').toLowerCase();
  // Targets that no longer exist keep their kind grouping but sort after live ones.
  return { kind, number: target?.sceneNumber ?? Number.MAX_SAFE_INTEGER, label };
}

/** Returns a new, sorted array; the input order is left untouched. */
export function sortNotes(
  notes: Note[],
  mode: NoteSortMode,
  targetsById: Map<string, AssociationTarget>
): Note[] {
  const sorted = [...notes];
  if (mode === 'newest') return sorted.sort((a, b) => timestamp(b) - timestamp(a));
  if (mode === 'oldest') return sorted.sort((a, b) => timestamp(a) - timestamp(b));
  if (mode === 'title') {
    return sorted.sort((a, b) => a.title.trim().localeCompare(b.title.trim()));
  }
  return sorted.sort((a, b) => {
    const left = associationRank(a, targetsById);
    const right = associationRank(b, targetsById);
    if (left.kind !== right.kind) return left.kind - right.kind;
    if (left.number !== right.number) return left.number - right.number;
    if (left.label !== right.label) return left.label.localeCompare(right.label);
    return timestamp(b) - timestamp(a);
  });
}
