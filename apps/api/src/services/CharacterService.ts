import mongoose from "mongoose";
import { Projects, Characters } from "../db-connector";
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
}

/** Payload for updating an existing character (in-place or add new version). */
export interface UpdateCharacterPayload {
  imageUrl?: string;
  newVersion?: boolean;
  details?: CharacterDetailPayload[];
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
 * Updates project modified_date. Uses a transaction when MongoDB supports it (replica set / mongos);
 * otherwise runs the same operations without a session for standalone MongoDB.
 */
export async function createCharacter(
  projectId: string,
  payload: CreateCharacterPayload
): Promise<mongoose.Document> {
  const details = payload.details ?? [];
  const firstDetail = details[0];
  const doc = {
    projectId: toObjectId(projectId),
    imageUrl: payload.imageUrl ?? undefined,
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
      toObjectId(projectId),
      {
        $push: { characterOrder: newCharacter._id },
        $set: { modified_date: nowIso() },
      },
      { session }
    ).exec();
    return created[0];
  };

  const runWithoutSession = async () => {
    const created = await Characters.create([doc]);
    const newCharacter = created[0];
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $push: { characterOrder: newCharacter._id },
      $set: { modified_date: nowIso() },
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
 * Updates the parent project's modified_date.
 */
export async function updateCharacter(
  characterId: string,
  payload: UpdateCharacterPayload
): Promise<mongoose.Document | null> {
  const character = await Characters.findById(toObjectId(characterId)).exec();
  if (!character) return null;
  const charObj = character as any;
  const versions = Array.isArray(charObj.details) ? charObj.details : [];
  const newVersion = !!payload.newVersion;
  const detailPayload = payload.details?.[0];

  if (payload.imageUrl !== undefined) {
    charObj.imageUrl = payload.imageUrl;
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
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $set: { modified_date: nowIso() },
    }).exec();
  }
  return character;
}

/**
 * Deletes a character and removes its _id from project.characterOrder.
 * Updates project modified_date. Uses a transaction when MongoDB supports it;
 * otherwise runs the same operations without a session for standalone MongoDB.
 * Returns the projectId when deleted so callers can revalidate by path.
 */
export async function deleteCharacter(
  characterId: string
): Promise<{ deleted: boolean; projectId?: string }> {
  const runWithSession = async (session: mongoose.mongo.ClientSession) => {
    const character = await Characters.findOne({ _id: toObjectId(characterId) })
      .session(session)
      .lean()
      .exec();
    if (!character) return { deleted: false };
    const projectId = (character as any).projectId?.toString?.() ?? (character as any).projectId;
    await Characters.deleteOne({ _id: toObjectId(characterId) }, { session }).exec();
    await Projects.findByIdAndUpdate(
      toObjectId(projectId),
      {
        $pull: { characterOrder: toObjectId(characterId) },
        $set: { modified_date: nowIso() },
      },
      { session }
    ).exec();
    return { deleted: true, projectId };
  };

  const runWithoutSession = async () => {
    const character = await Characters.findOne({ _id: toObjectId(characterId) }).lean().exec();
    if (!character) return { deleted: false };
    const projectId = (character as any).projectId?.toString?.() ?? (character as any).projectId;
    await Characters.deleteOne({ _id: toObjectId(characterId) }).exec();
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $pull: { characterOrder: toObjectId(characterId) },
      $set: { modified_date: nowIso() },
    }).exec();
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
