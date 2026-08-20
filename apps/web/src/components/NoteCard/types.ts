/** What a note is attached to. `none` is a free-floating project note. */
export type NoteAssociationKind = 'none' | 'character' | 'scene' | 'inspiration';

/** Every kind that actually points at something. */
export type LinkedAssociationKind = Exclude<NoteAssociationKind, 'none'>;

export interface NoteAssociation {
  kind: NoteAssociationKind;
  /** _id of the linked character, scene or inspiration item; null when kind is 'none'. */
  targetId: string | null;
  /** Denormalized display label, so the card renders without resolving the target. */
  label: string | null;
}

export interface Note {
  _id: string;
  projectId?: string;
  title: string;
  category: string;
  /** Rich text body, stored as HTML. */
  content: string;
  /** True once the note has made it into the story. */
  incorporated: boolean;
  /** False parks the note in the "Maybe" bucket — kept, but not committed to the story. */
  shouldIncorporate: boolean;
  association: NoteAssociation;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * An option in the note form's association picker, and the resolved target a card's
 * association chip opens a floating reference pane for.
 */
export interface AssociationTarget {
  /** _id of the character / scene / inspiration item — matches `NoteAssociation.targetId`. */
  id: string;
  kind: LinkedAssociationKind;
  /** Picker and chip text, e.g. `3. INT. KITCHEN - DAY`. */
  label: string;
  /**
   * What the floating reference pane is opened with: a character's name, a scene's raw
   * heading (the pane stores normalize these themselves), or an inspiration item's _id.
   * Empty when the target has no heading yet, in which case no pane can be opened.
   */
  paneKey: string;
  /** Scene ordinal, so notes can be ordered "by number". Undefined for other kinds. */
  sceneNumber?: number;
}

export const EMPTY_ASSOCIATION: NoteAssociation = { kind: 'none', targetId: null, label: null };

/** Normalizes a raw GraphQL note into the shape the UI works with. */
export function toNote(raw: Record<string, unknown>): Note {
  const association = (raw.association as Record<string, unknown> | undefined) ?? {};
  const kind = (association.kind as NoteAssociationKind | undefined) ?? 'none';
  return {
    _id: String(raw._id ?? ''),
    projectId: raw.projectId as string | undefined,
    title: (raw.title as string) ?? '',
    category: (raw.category as string) ?? '',
    content: (raw.content as string) ?? '',
    incorporated: Boolean(raw.incorporated),
    shouldIncorporate: raw.shouldIncorporate !== false,
    association:
      kind === 'none'
        ? EMPTY_ASSOCIATION
        : {
            kind,
            targetId: (association.targetId as string | null) ?? null,
            label: (association.label as string | null) ?? null,
          },
    createdAt: (raw.createdAt as string | null) ?? null,
    updatedAt: (raw.updatedAt as string | null) ?? null,
  };
}
