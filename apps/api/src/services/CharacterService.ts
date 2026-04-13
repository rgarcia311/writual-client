import mongoose from "mongoose";
import { Projects, Characters } from "@writual/db";
import { toObjectId, nowIso, isTransactionNotSupportedError } from "../utils/mongoUtils";

/** Single character detail (version) entry. */
export interface CharacterDetailPayload {
  version?: number;
  bio?: string;
  name?: string;
  age?: number;
  gender?: string;
  need?: string;
  want?: string;
}

/** Payload for creating a new character (order from project.characterOrder). */
export interface CreateCharacterPayload {
  imageUrl?: string;
  details?: CharacterDetailPayload[];
  activeVersion?: number;
  lockedVersion?: number;
}

/** Payload for updating an existing character (in-place or add new version). */
export interface UpdateCharacterPayload {
  imageUrl?: string;
  newVersion?: boolean;
  details?: CharacterDetailPayload[];
  activeVersion?: number;
  lockedVersion?: number | null;
}

/**
 * Returns characters for a project in the order defined by project.characterOrder.
 * Character "number" is derived by the client from array index (e.g. index + 1).
 */
export async function getCharactersByProjectId(
  projectId: string
): Promise<mongoose.Document[]> {
  const pid = toObjectId(projectId);
  const project = await Projects.findById(pid).lean().exec();
  if (!project) return [];
  const order = (project as any).characterOrder ?? [];
  if (order.length === 0) return [];
  const characters = await Characters.find({ _id: { $in: order } }).lean().exec();
  const byId = new Map(
    characters.map((c: any) => [c._id.toString(), c])
  );
  return order
    .map((id: mongoose.Types.ObjectId) => byId.get(id.toString()))
    .filter(Boolean);
}

/**
 * Batch load characters for multiple projects (same order as input projectIds).
 * For use with DataLoader to avoid N+1 when resolving Project.characters for many projects.
 */
export async function getCharactersByProjectIdsBatch(
  projectIds: readonly string[]
): Promise<any[][]> {
  if (projectIds.length === 0) return [];
  const ids = projectIds.map((id) => toObjectId(id));
  const projects = await Projects.find({ _id: { $in: ids } })
    .lean()
    .select("characterOrder")
    .exec();
  const byId = new Map(
    projects.map((p: any) => [p._id.toString(), (p.characterOrder ?? [])])
  );
  const allCharacterIds = new Set<mongoose.Types.ObjectId>();
  for (const p of projects) {
    const order = (p as any).characterOrder ?? [];
    order.forEach((id: mongoose.Types.ObjectId) => allCharacterIds.add(id));
  }
  const characterList = await Characters.find({ _id: { $in: Array.from(allCharacterIds) } })
    .lean()
    .exec();
  const charactersById = new Map(
    characterList.map((c: any) => [c._id.toString(), c])
  );
  return projectIds.map((pid) => {
    const order = byId.get(pid) ?? [];
    return order
      .map((id: mongoose.Types.ObjectId) => charactersById.get(id.toString()))
      .filter(Boolean);
  });
}

/**
 * Creates a new character and appends its _id to project.characterOrder.
 * Updates project modified_date and stats.totalCharacters.
 * Fails if charactersSectionLocked is true.
 */
export async function createCharacter(
  projectId: string,
  payload: CreateCharacterPayload
): Promise<mongoose.Document> {
  const pid = toObjectId(projectId);
  const project = await Projects.findById(pid).lean().exec();
  if (!project) throw new Error("Project not found");
  if ((project as any).charactersSectionLocked) {
    throw new Error("Characters section is locked; unlock to add characters.");
  }

  const details = payload.details ?? [];
  const firstDetail = details[0];
  const doc = {
    projectId: pid,
    imageUrl: payload.imageUrl ?? undefined,
    activeVersion: payload.activeVersion ?? 1,
    lockedVersion: payload.lockedVersion ?? undefined,
    details: details.length
      ? [
          {
            version: firstDetail.version ?? 1,
            bio: firstDetail.bio ?? "",
            name: firstDetail.name ?? "",
            age: firstDetail.age,
            gender: firstDetail.gender ?? "",
            need: firstDetail.need ?? "",
            want: firstDetail.want ?? "",
          },
        ]
      : [],
  };

  const runWithSession = async (session: mongoose.mongo.ClientSession) => {
    const created = await Characters.create([doc], { session });
    const newCharacter = created[0];
    await Projects.findByIdAndUpdate(
      pid,
      {
        $push: { characterOrder: newCharacter._id },
        $set: { modified_date: nowIso() },
        $inc: { "stats.totalCharacters": 1 },
      },
      { session }
    ).exec();
    return created[0];
  };

  const runWithoutSession = async () => {
    const created = await Characters.create([doc]);
    const newCharacter = created[0];
    await Projects.findByIdAndUpdate(pid, {
      $push: { characterOrder: newCharacter._id },
      $set: { modified_date: nowIso() },
      $inc: { "stats.totalCharacters": 1 },
    }).exec();
    return newCharacter;
  };

  try {
    const session = await mongoose.connection.startSession();
    session.startTransaction();
    try {
      const newCharacter = await runWithSession(session);
      await session.commitTransaction();
      return newCharacter;
    } catch (e) {
      await session.abortTransaction().catch(() => {});
      throw e;
    } finally {
      session.endSession();
    }
  } catch (e) {
    if (isTransactionNotSupportedError(e)) {
      return runWithoutSession();
    }
    throw e;
  }
}

/**
 * Updates an existing character (in-place version update or add new version).
 * Updates the parent project's modified_date and stats.lockedCharacters when lockedVersion changes.
 */
export async function updateCharacter(
  characterId: string,
  payload: UpdateCharacterPayload
): Promise<mongoose.Document | null> {
  const character = await Characters.findById(toObjectId(characterId)).exec();
  if (!character) return null;
  const charObj = character as any;
  const previousLockedVersion =
    charObj.lockedVersion != null ? Number(charObj.lockedVersion) : null;
  const versions = Array.isArray(charObj.details) ? charObj.details : [];
  const newVersion = !!payload.newVersion;
  const detailPayload = payload.details?.[0];

  if (payload.imageUrl !== undefined) {
    charObj.imageUrl = payload.imageUrl;
  }
  if (payload.activeVersion !== undefined) {
    charObj.activeVersion = payload.activeVersion;
  }
  if (payload.lockedVersion !== undefined) {
    charObj.lockedVersion = payload.lockedVersion === null ? undefined : payload.lockedVersion;
  }

  if (newVersion && detailPayload) {
    const nextVer = versions.length + 1;
    const newDetail = {
      version: nextVer,
      bio: detailPayload.bio ?? "",
      name: detailPayload.name ?? "",
      age: detailPayload.age,
      gender: detailPayload.gender ?? "",
      need: detailPayload.need ?? "",
      want: detailPayload.want ?? "",
    };
    charObj.details.push(newDetail);
  } else if (detailPayload) {
    const lastIndex = versions.length - 1;
    if (lastIndex >= 0) {
      const existing = versions[lastIndex];
      charObj.details[lastIndex] = {
        ...(existing.toObject?.() ?? existing),
        bio: detailPayload.bio ?? existing.bio ?? "",
        name: detailPayload.name ?? existing.name ?? "",
        age: detailPayload.age !== undefined && detailPayload.age !== null ? detailPayload.age : existing.age,
        gender: detailPayload.gender ?? existing.gender ?? "",
        need: detailPayload.need ?? existing.need ?? "",
        want: detailPayload.want ?? existing.want ?? "",
        version: existing.version ?? 1,
      };
    }
  }

  await character.save();
  const projectId = charObj.projectId?.toString?.() ?? charObj.projectId;
  if (projectId) {
    const newLockedVersion =
      charObj.lockedVersion != null ? Number(charObj.lockedVersion) : null;
    const wasLocked = previousLockedVersion != null;
    const isLocked = newLockedVersion != null;
    const inc: { "stats.lockedCharacters"?: number } = {};
    if (!wasLocked && isLocked) inc["stats.lockedCharacters"] = 1;
    else if (wasLocked && !isLocked) inc["stats.lockedCharacters"] = -1;
    const update: Record<string, unknown> = { $set: { modified_date: nowIso() } };
    if (Object.keys(inc).length) update.$inc = inc;
    await Projects.findByIdAndUpdate(toObjectId(projectId), update).exec();
  }
  return character;
}

/**
 * Deletes a character and removes its _id from project.characterOrder.
 * Updates project modified_date and stats. Fails if charactersSectionLocked is true.
 * Returns the projectId when deleted so callers can revalidate by path.
 */
export async function deleteCharacter(
  characterId: string
): Promise<{ deleted: boolean; projectId?: string }> {
  const cid = toObjectId(characterId);
  const runWithSession = async (session: mongoose.mongo.ClientSession) => {
    const character = await Characters.findOne({ _id: cid })
      .session(session)
      .lean()
      .exec();
    if (!character) return { deleted: false };
    const projectId = (character as any).projectId?.toString?.() ?? (character as any).projectId;
    const project = await Projects.findById(toObjectId(projectId)).session(session).lean().exec();
    if (project && (project as any).charactersSectionLocked) {
      throw new Error("Characters section is locked; unlock to delete characters.");
    }
    const wasLocked = (character as any).lockedVersion != null;
    const update: Record<string, unknown> = {
      $pull: { characterOrder: cid },
      $set: { modified_date: nowIso() },
      $inc: { "stats.totalCharacters": -1 },
    };
    if (wasLocked) (update.$inc as Record<string, number>)["stats.lockedCharacters"] = -1;
    await Characters.deleteOne({ _id: cid }, { session }).exec();
    await Projects.findByIdAndUpdate(toObjectId(projectId), update, { session }).exec();
    return { deleted: true, projectId };
  };

  const runWithoutSession = async () => {
    const character = await Characters.findOne({ _id: cid }).lean().exec();
    if (!character) return { deleted: false };
    const projectId = (character as any).projectId?.toString?.() ?? (character as any).projectId;
    const project = await Projects.findById(toObjectId(projectId)).lean().exec();
    if (project && (project as any).charactersSectionLocked) {
      throw new Error("Characters section is locked; unlock to delete characters.");
    }
    const wasLocked = (character as any).lockedVersion != null;
    const update: Record<string, unknown> = {
      $pull: { characterOrder: cid },
      $set: { modified_date: nowIso() },
      $inc: { "stats.totalCharacters": -1 },
    };
    if (wasLocked) (update.$inc as Record<string, number>)["stats.lockedCharacters"] = -1;
    await Characters.deleteOne({ _id: cid }).exec();
    await Projects.findByIdAndUpdate(toObjectId(projectId), update).exec();
    return { deleted: true, projectId };
  };

  try {
    const session = await mongoose.connection.startSession();
    session.startTransaction();
    try {
      const result = await runWithSession(session);
      if (!result.deleted) await session.abortTransaction();
      else await session.commitTransaction();
      return result;
    } catch (e) {
      await session.abortTransaction().catch(() => {});
      throw e;
    } finally {
      session.endSession();
    }
  } catch (e) {
    if (isTransactionNotSupportedError(e)) {
      return runWithoutSession();
    }
    throw e;
  }
}

/**
 * Locks all characters in the project: sets each character's lockedVersion to its activeVersion,
 * sets charactersSectionLocked true, and sets stats.lockedCharacters to totalCharacters.
 */
export async function lockAllCharactersForProject(
  projectId: string
): Promise<{ lockedCount: number }> {
  const pid = toObjectId(projectId);
  const project = await Projects.findById(pid).lean().exec();
  if (!project) throw new Error("Project not found");
  const order = (project as any).characterOrder ?? [];
  if (order.length === 0) {
    await Projects.findByIdAndUpdate(pid, {
      $set: { modified_date: nowIso(), charactersSectionLocked: true },
    }).exec();
    return { lockedCount: 0 };
  }
  const characters = await Characters.find({ _id: { $in: order } }).exec();
  for (const character of characters) {
    const c = character as any;
    const active = c.activeVersion ?? 1;
    c.lockedVersion = active;
    await character.save();
  }
  const totalCharacters = order.length;
  await Projects.findByIdAndUpdate(pid, {
    $set: {
      modified_date: nowIso(),
      charactersSectionLocked: true,
      "stats.lockedCharacters": totalCharacters,
      "stats.totalCharacters": totalCharacters,
    },
  }).exec();
  return { lockedCount: totalCharacters };
}

/**
 * Unlocks the characters section so characters can be added or deleted.
 * Does not change individual character lockedVersion values.
 */
export async function unlockCharactersSection(projectId: string): Promise<void> {
  await Projects.findByIdAndUpdate(toObjectId(projectId), {
    $set: { modified_date: nowIso(), charactersSectionLocked: false },
  }).exec();
}
