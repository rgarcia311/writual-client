import mongoose from "mongoose";
import { Projects, Scenes, Characters } from "@writual/db";
import { nowIso } from "../utils/mongoUtils";

/**
 * Deletion helpers for the characters and scenes that belong to a screenplay document.
 *
 * Both paths keep `project.characterOrder`, `project.sceneOrder` and `project.stats` consistent
 * with the rows they remove; the card grids read their order from those arrays and the dashboard
 * reads its progress dots from those counters, so a bare `deleteMany` would leave both stale.
 */

/**
 * Removes the characters and scenes tagged to a screenplay document, keeping `characterOrder`,
 * `sceneOrder` and `stats` consistent. Entities with no `screenplayDocumentId` belong to the
 * primary document by convention and are only touched when `documentId` is that primary — handled
 * by the caller passing `includeUntagged`.
 *
 * Locked cards are skipped unless `includeLocked` is set. Locking is the writer's explicit "this
 * one is finished" mark, and the "replace specific" picker refuses to select locked cards for the
 * same reason; a replacing import honouring that too means locking always protects a card. Deleting
 * the whole screenplay document does pass `includeLocked`, since cards left behind would point at a
 * document that no longer exists.
 */
export async function deleteEntitiesForDocument(
  projectId: mongoose.Types.ObjectId,
  documentId: mongoose.Types.ObjectId,
  options: { includeUntagged?: boolean; includeLocked?: boolean } = {}
): Promise<{ charactersDeleted: number; scenesDeleted: number }> {
  const documentMatch = options.includeUntagged
    ? { $or: [{ screenplayDocumentId: documentId }, { screenplayDocumentId: null }] }
    : { screenplayDocumentId: documentId };
  const match = {
    projectId,
    ...documentMatch,
    ...(options.includeLocked ? {} : { lockedVersion: { $in: [null, undefined] } }),
  };

  const [characters, scenes] = await Promise.all([
    Characters.find(match).select("_id lockedVersion").lean().exec(),
    Scenes.find(match).select("_id lockedVersion").lean().exec(),
  ]);

  const characterIds = characters.map((c) => (c as { _id: mongoose.Types.ObjectId })._id);
  const sceneIds = scenes.map((s) => (s as { _id: mongoose.Types.ObjectId })._id);
  const lockedCharacters = characters.filter(
    (c) => (c as { lockedVersion?: number | null }).lockedVersion != null
  ).length;
  const lockedScenes = scenes.filter(
    (s) => (s as { lockedVersion?: number | null }).lockedVersion != null
  ).length;

  if (characterIds.length > 0) {
    await Characters.deleteMany({ _id: { $in: characterIds } }).exec();
  }
  if (sceneIds.length > 0) {
    await Scenes.deleteMany({ _id: { $in: sceneIds } }).exec();
  }

  if (characterIds.length > 0 || sceneIds.length > 0) {
    await Projects.findByIdAndUpdate(projectId, {
      $pull: {
        characterOrder: { $in: characterIds },
        sceneOrder: { $in: sceneIds },
      },
      $inc: {
        "stats.totalCharacters": -characterIds.length,
        "stats.lockedCharacters": -lockedCharacters,
        "stats.totalScenes": -sceneIds.length,
        "stats.lockedScenes": -lockedScenes,
      },
      $set: { modified_date: nowIso() },
    }).exec();
  }

  return { charactersDeleted: characterIds.length, scenesDeleted: sceneIds.length };
}

/**
 * Deletes a caller-chosen subset of characters/scenes. Used by the "replace specific" import path,
 * where the user picks which existing cards the import should overwrite and which to keep.
 */
export async function deleteSelectedEntities(
  projectId: mongoose.Types.ObjectId,
  characterIds: string[],
  sceneIds: string[]
): Promise<{ charactersDeleted: number; scenesDeleted: number }> {
  const cids = toObjectIds(characterIds);
  const sids = toObjectIds(sceneIds);
  if (cids.length === 0 && sids.length === 0) {
    return { charactersDeleted: 0, scenesDeleted: 0 };
  }

  // Scoped to the project so a caller cannot delete another project's entities by id.
  const [characters, scenes] = await Promise.all([
    cids.length
      ? Characters.find({ _id: { $in: cids }, projectId }).select("_id lockedVersion").lean().exec()
      : Promise.resolve([]),
    sids.length
      ? Scenes.find({ _id: { $in: sids }, projectId }).select("_id lockedVersion").lean().exec()
      : Promise.resolve([]),
  ]);

  const foundCharacterIds = characters.map((c) => (c as { _id: mongoose.Types.ObjectId })._id);
  const foundSceneIds = scenes.map((s) => (s as { _id: mongoose.Types.ObjectId })._id);
  const lockedCharacters = characters.filter(
    (c) => (c as { lockedVersion?: number | null }).lockedVersion != null
  ).length;
  const lockedScenes = scenes.filter(
    (s) => (s as { lockedVersion?: number | null }).lockedVersion != null
  ).length;

  if (foundCharacterIds.length > 0) {
    await Characters.deleteMany({ _id: { $in: foundCharacterIds } }).exec();
  }
  if (foundSceneIds.length > 0) {
    await Scenes.deleteMany({ _id: { $in: foundSceneIds } }).exec();
  }

  if (foundCharacterIds.length > 0 || foundSceneIds.length > 0) {
    await Projects.findByIdAndUpdate(projectId, {
      $pull: {
        characterOrder: { $in: foundCharacterIds },
        sceneOrder: { $in: foundSceneIds },
      },
      $inc: {
        "stats.totalCharacters": -foundCharacterIds.length,
        "stats.lockedCharacters": -lockedCharacters,
        "stats.totalScenes": -foundSceneIds.length,
        "stats.lockedScenes": -lockedScenes,
      },
      $set: { modified_date: nowIso() },
    }).exec();
  }

  return {
    charactersDeleted: foundCharacterIds.length,
    scenesDeleted: foundSceneIds.length,
  };
}

function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  const out: mongoose.Types.ObjectId[] = [];
  for (const id of ids) {
    if (mongoose.Types.ObjectId.isValid(id)) out.push(new mongoose.Types.ObjectId(id));
  }
  return out;
}


/**
 * The character names and scene headings a screenplay document already has.
 *
 * An import runs after the clearing step, so whatever this returns is what genuinely survived —
 * cards the writer chose to keep, and locked cards, which no strategy deletes. Recreating any of
 * them from the incoming script is what produced duplicate cards, so the import skips them.
 *
 * Scene headings are counted rather than collected into a set: a script legitimately revisits a
 * location ("INT. KITCHEN - DAY" three times is three scenes), so the import must only skip as many
 * repeats as already exist and create the rest.
 */
export async function loadExistingEntityKeys(
  projectId: mongoose.Types.ObjectId,
  documentId: mongoose.Types.ObjectId,
  options: { includeUntagged?: boolean } = {}
): Promise<{ characterNames: Set<string>; sceneHeadingCounts: Map<string, number> }> {
  const documentMatch = options.includeUntagged
    ? { $or: [{ screenplayDocumentId: documentId }, { screenplayDocumentId: null }] }
    : { screenplayDocumentId: documentId };
  const match = { projectId, ...documentMatch };

  const [characters, scenes] = await Promise.all([
    Characters.find(match).select("details").lean().exec(),
    Scenes.find(match).select("versions activeVersion").lean().exec(),
  ]);

  const characterNames = new Set<string>();
  for (const c of characters as Array<{ details?: Array<{ name?: string }> }>) {
    // Every version's name counts. A rename across versions would otherwise read as "missing" and
    // be recreated; over-matching only ever means "leave it alone", which is the safer mistake.
    for (const detail of c.details ?? []) {
      const key = normalizeEntityKey(detail?.name);
      if (key) characterNames.add(key);
    }
  }

  const sceneHeadingCounts = new Map<string, number>();
  for (const s of scenes as Array<{
    versions?: Array<{ version?: number; sceneHeading?: string }>;
    activeVersion?: number;
  }>) {
    const versions = s.versions ?? [];
    const active =
      versions.find((v) => Number(v?.version) === Number(s.activeVersion ?? 1)) ?? versions[0];
    const key = normalizeEntityKey(active?.sceneHeading);
    if (!key) continue;
    sceneHeadingCounts.set(key, (sceneHeadingCounts.get(key) ?? 0) + 1);
  }

  return { characterNames, sceneHeadingCounts };
}

/** Case- and whitespace-insensitive match key; empty string means "no usable value". */
export function normalizeEntityKey(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}
