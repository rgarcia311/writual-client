import mongoose from "mongoose";
import { Projects, Scenes } from "../db-connector";
import { toObjectId, nowIso, isTransactionNotSupportedError } from "../utils/mongoUtils";

/** Payload for creating a new scene (no number; order comes from project.sceneOrder). */
export interface CreateScenePayload {
  activeVersion?: number;
  lockedVersion?: number;
  newVersion?: boolean;
  newScene?: boolean;
  versions?: Array<{
    version?: number;
    locked?: boolean;
    thesis?: string;
    antithesis?: string;
    synthesis?: string;
    synopsis?: string;
    act?: number;
    step?: string;
    sceneHeading?: string;
    content?: string;
  }>;
}

/** Payload for updating an existing scene (version in-place or add new version). */
export interface UpdateScenePayload {
  activeVersion?: number;
  lockedVersion?: number | null;
  newVersion?: boolean;
  versions?: Array<{
    version?: number;
    locked?: boolean;
    thesis?: string;
    antithesis?: string;
    synthesis?: string;
    synopsis?: string;
    act?: number;
    step?: string;
    sceneHeading?: string;
    content?: string;
  }>;
}

/**
 * Returns scenes for a project in the order defined by project.sceneOrder.
 * Scene "number" is derived by the client from array index (e.g. index + 1).
 */
export async function getScenesByProjectId(
  projectId: string
): Promise<mongoose.Document[]> {
  const pid = toObjectId(projectId);
  const project = await Projects.findById(pid).lean().exec();
  if (!project) return [];
  const order = (project as any).sceneOrder ?? [];
  if (order.length === 0) return [];
  const scenes = await Scenes.find({ _id: { $in: order } }).lean().exec();
  const byId = new Map(
    scenes.map((s: any) => [s._id.toString(), s])
  );
  return order
    .map((id: mongoose.Types.ObjectId) => byId.get(id.toString()))
    .filter(Boolean);
}

/**
 * Batch load scenes for multiple projects (same order as input projectIds).
 * For use with DataLoader to avoid N+1 when resolving Project.scenes for many projects.
 */
export async function getScenesByProjectIdsBatch(
  projectIds: readonly string[]
): Promise<any[][]> {
  if (projectIds.length === 0) return [];
  const ids = projectIds.map((id) => toObjectId(id));
  const projects = await Projects.find({ _id: { $in: ids } })
    .lean()
    .select("sceneOrder")
    .exec();
  const byId = new Map(
    projects.map((p: any) => [p._id.toString(), (p.sceneOrder ?? [])])
  );
  const allSceneIds = new Set<mongoose.Types.ObjectId>();
  for (const p of projects) {
    const order = (p as any).sceneOrder ?? [];
    order.forEach((id: mongoose.Types.ObjectId) => allSceneIds.add(id));
  }
  const sceneList = await Scenes.find({ _id: { $in: Array.from(allSceneIds) } })
    .lean()
    .exec();
  const scenesById = new Map(
    sceneList.map((s: any) => [s._id.toString(), s])
  );
  return projectIds.map((pid) => {
    const order = byId.get(pid) ?? [];
    return order
      .map((id: mongoose.Types.ObjectId) => scenesById.get(id.toString()))
      .filter(Boolean);
  });
}

/**
 * Creates a new scene and appends its _id to project.sceneOrder.
 * Updates project modified_date. Uses a transaction when MongoDB supports it (replica set / mongos);
 * otherwise runs the same operations without a session for standalone MongoDB.
 */
export async function createScene(
  projectId: string,
  payload: CreateScenePayload
): Promise<mongoose.Document> {
  const doc = {
    projectId: toObjectId(projectId),
    activeVersion: payload.activeVersion ?? 1,
    lockedVersion: payload.lockedVersion ?? undefined,
    newVersion: payload.newVersion ?? undefined,
    newScene: payload.newScene ?? undefined,
    versions: payload.versions ?? [],
  };

  const runWithSession = async (session: mongoose.mongo.ClientSession) => {
    const created = await Scenes.create([doc], { session });
    const newScene = created[0];
    await Projects.findByIdAndUpdate(
      toObjectId(projectId),
      {
        $push: { sceneOrder: newScene._id },
        $set: { modified_date: nowIso() },
      },
      { session }
    ).exec();
    return created[0];
  };

  const runWithoutSession = async () => {
    const created = await Scenes.create([doc]);
    const newScene = created[0];
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $push: { sceneOrder: newScene._id },
      $set: { modified_date: nowIso() },
    }).exec();
    return newScene;
  };

  try {
    const session = await mongoose.connection.startSession();
    session.startTransaction();
    try {
      const newScene = await runWithSession(session);
      await session.commitTransaction();
      return newScene;
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
 * Updates an existing scene (version in-place or add new version).
 * Updates the parent project's modified_date.
 */
export async function updateScene(
  sceneId: string,
  payload: UpdateScenePayload
): Promise<mongoose.Document | null> {
  const scene = await Scenes.findById(toObjectId(sceneId)).exec();
  if (!scene) return null;
  const sceneObj = scene as any;
  const versions = Array.isArray(sceneObj.versions) ? sceneObj.versions : [];
  const newVersion = !!payload.newVersion;
  const versionPayload = payload.versions?.[0];
  const activeVersion = payload.activeVersion ?? sceneObj.activeVersion ?? 1;

  if (newVersion && versionPayload) {
    const nextVer = versions.length + 1;
    const newVer = {
      version: nextVer,
      locked: versionPayload.locked ?? false,
      thesis: versionPayload.thesis ?? "",
      antithesis: versionPayload.antithesis ?? "",
      synthesis: versionPayload.synthesis ?? "",
      synopsis: versionPayload.synopsis ?? "",
      act: versionPayload.act,
      step: versionPayload.step ?? "",
      sceneHeading: versionPayload.sceneHeading ?? "",
      content: versionPayload.content ?? "",
    };
    sceneObj.versions.push(newVer);
    sceneObj.activeVersion = activeVersion;
    if (payload.lockedVersion !== undefined && payload.lockedVersion !== null) {
      sceneObj.lockedVersion = payload.lockedVersion;
    }
  } else if (versionPayload) {
    const versionIndex = versions.findIndex(
      (v: any) => Number(v.version) === activeVersion
    );
    if (versionIndex >= 0) {
      const existing = versions[versionIndex];
      sceneObj.versions[versionIndex] = {
        ...existing.toObject?.() ?? existing,
        thesis: versionPayload.thesis ?? existing.thesis ?? "",
        antithesis: versionPayload.antithesis ?? existing.antithesis ?? "",
        synthesis: versionPayload.synthesis ?? existing.synthesis ?? "",
        synopsis: versionPayload.synopsis ?? existing.synopsis ?? "",
        step: versionPayload.step ?? existing.step ?? "",
        sceneHeading: versionPayload.sceneHeading ?? existing.sceneHeading ?? "",
        content: versionPayload.content ?? existing.content ?? "",
        act: versionPayload.act !== undefined && versionPayload.act !== null ? versionPayload.act : existing.act,
        version: activeVersion,
      };
    }
    sceneObj.activeVersion = activeVersion;
    if (payload.lockedVersion !== undefined && payload.lockedVersion !== null) {
      sceneObj.lockedVersion = payload.lockedVersion;
    } else if (payload.lockedVersion === null) {
      sceneObj.lockedVersion = undefined;
    }
  }
  await scene.save();
  const projectId = sceneObj.projectId?.toString?.() ?? sceneObj.projectId;
  if (projectId) {
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $set: { modified_date: nowIso() },
    }).exec();
  }
  return scene;
}

/**
 * Deletes a scene and removes its _id from project.sceneOrder.
 * Updates project modified_date. Uses a transaction when MongoDB supports it;
 * otherwise runs the same operations without a session for standalone MongoDB.
 * Returns the projectId when deleted so callers can revalidate by path.
 */
export async function deleteScene(
  sceneId: string
): Promise<{ deleted: boolean; projectId?: string }> {
  const runWithSession = async (session: mongoose.mongo.ClientSession) => {
    const scene = await Scenes.findOne({ _id: toObjectId(sceneId) })
      .session(session)
      .lean()
      .exec();
    if (!scene) return { deleted: false };
    const projectId = (scene as any).projectId?.toString?.() ?? (scene as any).projectId;
    await Scenes.deleteOne({ _id: toObjectId(sceneId) }, { session }).exec();
    await Projects.findByIdAndUpdate(
      toObjectId(projectId),
      {
        $pull: { sceneOrder: toObjectId(sceneId) },
        $set: { modified_date: nowIso() },
      },
      { session }
    ).exec();
    return { deleted: true, projectId };
  };

  const runWithoutSession = async () => {
    const scene = await Scenes.findOne({ _id: toObjectId(sceneId) }).lean().exec();
    if (!scene) return { deleted: false };
    const projectId = (scene as any).projectId?.toString?.() ?? (scene as any).projectId;
    await Scenes.deleteOne({ _id: toObjectId(sceneId) }).exec();
    await Projects.findByIdAndUpdate(toObjectId(projectId), {
      $pull: { sceneOrder: toObjectId(sceneId) },
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
