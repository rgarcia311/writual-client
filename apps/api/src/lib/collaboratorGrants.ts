import mongoose from 'mongoose';
import { listScreenplayDocuments } from '../services/ScreenplayDocumentService';

/** Narrows a requested screenplay grant to documents the project actually holds. */
export type ScreenplayGrantNormalizer = (
  requested: readonly string[] | null | undefined
) => Promise<mongoose.Types.ObjectId[]>;

/**
 * Builds a normalizer for one project's screenplay grants.
 *
 * Empty is the canonical "every document" value, so three cases all collapse to it: no selection,
 * a selection naming only documents the project no longer has, and a selection covering every
 * document. The last matters most — storing "all" as an explicit id list would silently exclude
 * the next draft the writer adds, which is exactly the access gap collaborators run into.
 *
 * The document list is fetched at most once, and only when a grant actually names ids: reading it
 * migrates legacy projects as a side effect, which an invite that grants everything need not do.
 */
export function screenplayGrantNormalizer(projectId: string): ScreenplayGrantNormalizer {
  let known: Map<string, mongoose.Types.ObjectId> | null = null;

  return async (requested) => {
    if (!Array.isArray(requested) || requested.length === 0) return [];

    if (!known) {
      const documents = await listScreenplayDocuments(projectId);
      known = new Map(documents.map((d) => [String(d._id), d._id]));
    }

    const picked = [...new Set(requested.map((id) => String(id)))].filter((id) => known!.has(id));
    if (picked.length === 0 || picked.length === known.size) return [];
    return picked.map((id) => known!.get(id)!);
  };
}
