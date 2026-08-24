import {
  ASPECT_LABELS,
  hasAllScreenplayDocuments,
  type AspectKey,
  type Collaborator,
} from '@/interfaces/collaborator';
import type { SharableScreenplayDocument } from '@hooks/useProjectSharing';

/** What a collaborator was let into, as a sentence fragment: "Characters, Outline, Screenplay". */
export function summarizeAspects(aspects: AspectKey[] | null | undefined): string {
  const labels = (aspects ?? []).map((aspect) => ASPECT_LABELS[aspect]).filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : 'Nothing shared yet';
}

/**
 * How much of the screenplay a collaborator reaches, or `null` when they were not given the
 * screenplay aspect at all and the question does not arise.
 *
 * Named documents are listed rather than counted while the list is short — "Draft 2" tells the
 * owner more at a glance than "1 of 3 screenplays" does.
 */
export function summarizeScreenplayGrant(
  collaborator: Pick<Collaborator, 'aspects' | 'screenplayDocumentIds'>,
  documents: SharableScreenplayDocument[],
): string | null {
  if (!(collaborator.aspects ?? []).includes('screenplay')) return null;
  if (hasAllScreenplayDocuments(collaborator)) {
    return documents.length > 1 ? 'All screenplays' : 'Screenplay';
  }

  const granted = collaborator.screenplayDocumentIds;
  const names = documents
    .filter((document) => granted.includes(document._id))
    .map((document) => document.name);

  // Ids the project no longer has — a deleted draft — leave the list short; fall back to a count
  // rather than claiming access to fewer screenplays than were actually granted.
  if (names.length === 0) return `${granted.length} screenplay${granted.length === 1 ? '' : 's'}`;
  if (names.length <= 2) return names.join(', ');
  return `${names.length} of ${documents.length} screenplays`;
}
