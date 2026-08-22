import mongoose from 'mongoose';
import { Projects } from '@writual/db';
import { createCharacter as createCharacterService } from './CharacterService';
import { createScene as createSceneService } from './SceneService';
import {
  extractDialogueCueCharacters,
  extractOutlineScenesForEnrichment,
} from '../lib/entitiesFromScreenplayDoc';
import { forwardEnrichmentToAi, type EnrichScreenplayImportResponse } from '../lib/aiEnrichment';
import {
  createScreenplayDocument,
  resolveScreenplayDocument,
  saveScreenplayDocument,
  type ScreenplayDocumentRow,
} from './ScreenplayDocumentService';
import {
  deleteEntitiesForDocument,
  deleteSelectedEntities,
  loadExistingEntityKeys,
  normalizeEntityKey,
} from './ScreenplayEntityService';

/**
 * Orchestrates a parsed-PDF import into a project.
 *
 * Two shapes, chosen by the user in the import dialog:
 *  - `replace` — overwrite an existing screenplay document's content in place. When the import also
 *    builds characters and scenes, the caller says whether that wipes every entity on the document
 *    (`entityStrategy: 'all'`) or only a hand-picked subset (`'selected'`).
 *  - `add` — create a second screenplay document alongside the existing ones. Its characters and
 *    scenes are tagged with the new document's id, which is what the characters and outline pages
 *    render as a separate tab.
 */

export type ImportMode = 'replace' | 'add';
export type EntityStrategy = 'all' | 'selected' | 'none';

export interface ScreenplayImportRequest {
  projectId: string;
  /** TipTap document produced by the client-side PDF parser. */
  doc: Record<string, unknown>;
  pageCount: number;
  layout?: Record<string, unknown>;
  mode: ImportMode;
  /** `replace`: which document to overwrite. Omit to target the project's primary. */
  documentId?: string | null;
  /** `add`: tab label for the new document. Defaults to the source file name. */
  documentName?: string | null;
  sourceFileName?: string | null;
  /** When false, only the screenplay content is written — no characters or scenes are built. */
  withAi: boolean;
  /** `replace` + `withAi` only; ignored otherwise. */
  entityStrategy?: EntityStrategy;
  /** `entityStrategy: 'selected'` — the existing cards the user chose to overwrite. */
  replaceCharacterIds?: string[];
  replaceSceneIds?: string[];
}

export interface ScreenplayImportResult {
  documentId: string;
  documentName: string;
  isNewDocument: boolean;
  charactersCreated: number;
  scenesCreated: number;
  charactersRemoved: number;
  scenesRemoved: number;
  entityErrors: string[];
}

export async function importScreenplayPdf(
  request: ScreenplayImportRequest,
): Promise<ScreenplayImportResult> {
  const { projectId, doc, pageCount, layout, mode, withAi } = request;
  const pid = new mongoose.Types.ObjectId(projectId);

  const target =
    mode === 'add'
      ? await createTargetForAdd(request)
      : await replaceExistingDocument(request);

  const entityErrors: string[] = [];
  let charactersRemoved = 0;
  let scenesRemoved = 0;

  // Clearing happens before creation so a full replace does not briefly double every card.
  if (mode === 'replace' && withAi) {
    const removal = await clearEntitiesForReplace(request, pid, target);
    charactersRemoved = removal.charactersDeleted;
    scenesRemoved = removal.scenesDeleted;
  }

  if (!withAi) {
    return {
      documentId: String(target._id),
      documentName: target.name,
      isNewDocument: mode === 'add',
      charactersCreated: 0,
      scenesCreated: 0,
      charactersRemoved,
      scenesRemoved,
      entityErrors,
    };
  }

  const created = await buildEntities(projectId, target, doc, entityErrors);

  return {
    documentId: String(target._id),
    documentName: target.name,
    isNewDocument: mode === 'add',
    charactersCreated: created.charactersCreated,
    scenesCreated: created.scenesCreated,
    charactersRemoved,
    scenesRemoved,
    entityErrors,
  };
}

async function createTargetForAdd(
  request: ScreenplayImportRequest,
): Promise<ScreenplayDocumentRow> {
  const name =
    request.documentName?.trim() ||
    stripPdfExtension(request.sourceFileName) ||
    null;
  return createScreenplayDocument(request.projectId, {
    name,
    content: request.doc,
    layout: request.layout,
    pageCount: request.pageCount,
    sourceFileName: request.sourceFileName ?? null,
  });
}

async function replaceExistingDocument(
  request: ScreenplayImportRequest,
): Promise<ScreenplayDocumentRow> {
  const target = await resolveScreenplayDocument(request.projectId, request.documentId ?? null);
  const saved = await saveScreenplayDocument(request.projectId, String(target._id), {
    content: request.doc,
    layout: request.layout,
    pageCount: request.pageCount,
    // The editor's Y.Doc holds the *old* script. Without dropping it, the next client to connect
    // re-syncs that state and writes it straight back over the import.
    resetCollaboration: true,
  });

  // Seed the project's page goal from the import, but only when replacing the main draft and only
  // when the writer has not set a goal of their own — an import must not silently retarget it.
  if (target.isPrimary && request.pageCount > 0) {
    await Projects.updateOne(
      {
        _id: new mongoose.Types.ObjectId(request.projectId),
        $or: [{ pageCountEstimate: { $exists: false } }, { pageCountEstimate: null }],
      },
      { $set: { pageCountEstimate: request.pageCount } },
    ).exec();
  }

  return saved ?? target;
}

async function clearEntitiesForReplace(
  request: ScreenplayImportRequest,
  pid: mongoose.Types.ObjectId,
  target: ScreenplayDocumentRow,
): Promise<{ charactersDeleted: number; scenesDeleted: number }> {
  if (request.entityStrategy === 'none') {
    return { charactersDeleted: 0, scenesDeleted: 0 };
  }
  if (request.entityStrategy === 'selected') {
    return deleteSelectedEntities(
      pid,
      request.replaceCharacterIds ?? [],
      request.replaceSceneIds ?? [],
    );
  }
  // 'all': every entity on the replaced document. Cards created before multi-document support
  // carry no `screenplayDocumentId` and belong to the primary document by convention, so they are
  // only swept up when the primary is what's being replaced.
  return deleteEntitiesForDocument(pid, target._id, { includeUntagged: target.isPrimary });
}

/**
 * Derives characters and scenes from the imported script and writes them tagged to `documentId`.
 *
 * Character names and scene headings come from the document deterministically; the AI service only
 * refines them (filtering false-positive cues, adding thesis/antithesis/synthesis per scene). If it
 * is unreachable or returns nothing usable, the deterministic extraction still lands — an import
 * never fails outright because enrichment did.
 */
async function buildEntities(
  projectId: string,
  target: ScreenplayDocumentRow,
  doc: Record<string, unknown>,
  entityErrors: string[],
): Promise<{ charactersCreated: number; scenesCreated: number }> {
  const documentId = String(target._id);
  // A locked section refuses every single create. Checking once turns what would be hundreds of
  // identical failures into one message the writer can act on.
  const project = await Projects.findById(new mongoose.Types.ObjectId(projectId))
    .select('charactersSectionLocked outlineSectionLocked')
    .lean()
    .exec();
  const charactersLocked = Boolean(
    (project as { charactersSectionLocked?: boolean } | null)?.charactersSectionLocked,
  );
  const scenesLocked = Boolean(
    (project as { outlineSectionLocked?: boolean } | null)?.outlineSectionLocked,
  );
  if (charactersLocked) {
    entityErrors.push(
      'Characters section is locked, so no character cards were created. Unlock it and re-import to add them.',
    );
  }
  if (scenesLocked) {
    entityErrors.push(
      'Outline section is locked, so no scene cards were created. Unlock it and re-import to add them.',
    );
  }
  if (charactersLocked && scenesLocked) {
    return { charactersCreated: 0, scenesCreated: 0 };
  }

  /**
   * Whatever survived the clearing step above. Every strategy runs through here, so this covers the
   * cards a writer chose to keep *and* locked cards, which no strategy deletes — recreating either
   * from the incoming script is what produced duplicates.
   */
  const existing = await loadExistingEntityKeys(
    new mongoose.Types.ObjectId(projectId),
    target._id,
    { includeUntagged: target.isPrimary },
  );

  const deterministicChars = extractDialogueCueCharacters(doc);
  const outlineScenes = extractOutlineScenesForEnrichment(doc);

  let finalChars = deterministicChars;
  let sceneAnalyses: NonNullable<EnrichScreenplayImportResponse['sceneAnalyses']> = [];
  const enrichmentWarnings: string[] = [];

  try {
    const enriched = await forwardEnrichmentToAi({
      projectId,
      characterNames: deterministicChars.map((c) => c.name),
      scenes: outlineScenes.map((s) => ({
        index: s.index,
        sceneHeading: s.sceneHeading,
        synopsis: s.synopsis,
        scenePlainText: s.scenePlainText,
      })),
    });
    const aiChars = Array.isArray(enriched.characters)
      ? enriched.characters
          .filter((c) => c && typeof c.name === 'string' && c.name.trim() !== '')
          .map((c) => ({ name: (c.name as string).trim() }))
      : [];
    if (aiChars.length > 0) finalChars = aiChars;
    sceneAnalyses = Array.isArray(enriched.sceneAnalyses) ? enriched.sceneAnalyses : [];
    if (Array.isArray(enriched.warnings)) enrichmentWarnings.push(...enriched.warnings);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI enrichment unavailable';
    console.error('[screenplay-import] forward to AI:', message);
    enrichmentWarnings.push(message);
  }

  const analysisByIndex = new Map<number, NonNullable<(typeof sceneAnalyses)[number]>>();
  for (const a of sceneAnalyses) {
    if (!a || typeof a.index !== 'number' || !Number.isFinite(a.index)) continue;
    analysisByIndex.set(Math.floor(a.index), a);
  }

  let charactersCreated = 0;
  let scenesCreated = 0;

  for (const c of charactersLocked ? [] : finalChars) {
    const name = typeof c?.name === 'string' ? c.name.trim() : '';
    if (!name) continue;
    // Already on this document — leave the writer's card, with whatever bio they wrote, alone.
    if (existing.characterNames.has(normalizeEntityKey(name))) continue;
    try {
      await createCharacterService(projectId, {
        activeVersion: 1,
        screenplayDocumentId: documentId,
        details: [{ name, version: 1 }],
      });
      charactersCreated++;
    } catch (err) {
      entityErrors.push(
        `character "${name}": ${err instanceof Error ? err.message : 'failed'}`,
      );
    }
  }

  for (const meta of scenesLocked ? [] : outlineScenes) {
    const sceneHeading = meta.sceneHeading.trim();
    if (!sceneHeading) continue;

    // Skip only as many repeats of a heading as already exist: a script that returns to the same
    // location three times is three scenes, and only the ones already on the board are duplicates.
    const headingKey = normalizeEntityKey(sceneHeading);
    const remaining = existing.sceneHeadingCounts.get(headingKey) ?? 0;
    if (remaining > 0) {
      existing.sceneHeadingCounts.set(headingKey, remaining - 1);
      continue;
    }

    const synopsis =
      typeof meta.synopsis === 'string' && meta.synopsis.trim() ? meta.synopsis.trim() : undefined;
    const ana = analysisByIndex.get(meta.index);

    try {
      await createSceneService(projectId, {
        activeVersion: 1,
        screenplayDocumentId: documentId,
        versions: [
          {
            version: 1,
            sceneHeading,
            synopsis,
            thesis: typeof ana?.thesis === 'string' ? ana.thesis.trim() : undefined,
            antithesis: typeof ana?.antithesis === 'string' ? ana.antithesis.trim() : undefined,
            synthesis: typeof ana?.synthesis === 'string' ? ana.synthesis.trim() : undefined,
          },
        ],
      });
      scenesCreated++;
    } catch (err) {
      const label =
        sceneHeading.length > 40 ? `${sceneHeading.slice(0, 40)}…` : sceneHeading;
      entityErrors.push(`scene "${label}": ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  for (const w of enrichmentWarnings.slice(0, 12)) {
    entityErrors.push(`enrichment: ${w}`);
  }

  return { charactersCreated, scenesCreated };
}

function stripPdfExtension(fileName: string | null | undefined): string | null {
  if (typeof fileName !== 'string') return null;
  const trimmed = fileName.trim().replace(/\.pdf$/i, '');
  return trimmed === '' ? null : trimmed;
}
