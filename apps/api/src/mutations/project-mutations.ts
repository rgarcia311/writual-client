import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { Projects, Scenes, OutlineFrameworks } from "@writual/db";
import {
    insertData,
    deleteData,
    updateData,
} from "../helpers";
import { lockAllScenesForProject, unlockOutlineSection as unlockOutlineSectionService } from "../services/SceneService";
import { lockAllCharactersForProject, unlockCharactersSection as unlockCharactersSectionService } from "../services/CharacterService";
import { resolveScreenplayDocument, saveScreenplayDocument } from "../services/ScreenplayDocumentService";
export const deleteProject = (root,  { id }) => {
    return deleteData(Projects, id)
}

export const createProject = (root, { input }) => {
    const writingTracker = input.writingTracker ?? null;
    const trackerSignalsProgress =
        writingTracker != null &&
        typeof writingTracker === "object" &&
        writingTracker.enabled === true;
    const progressTrackingEnabled =
        Boolean(input.progressTrackingEnabled) || trackerSignalsProgress;

    const newProject = new Projects({
        user: input.user,
        displayName: input.displayName,
        email: input.email,
        type: input.type,
        title: input.title,
        logline: input.logline,
        genre: input.genre,
        budget: input.budget,
        poster: input.poster,
        similarProjects: input.similarProjects,
        sharedWith: input.sharedWith,
        outlineName: input.outlineName,
        scenes: input.scenes,
        characterOrder: input.characterOrder ?? [],
        outline: input.outline,
        writingTracker,
        progressTrackingEnabled,
    })


    return insertData(newProject)
}

export const shareProject = (root, { id, user }) => {
    //create helper for update 
    return updateData(Projects, {sharedWith: user}, id) //which project, which key and what value as args
}

export const updateProject = async (root, { project }) => {
  const id = project._id ?? project.projectId;
  if (!id) throw new Error('updateProject requires _id or projectId');
  const filter = mongoose.Types.ObjectId.isValid(id)
    ? { _id: new mongoose.Types.ObjectId(id) }
    : { _id: id };
  const updateFields = { ...project };
  delete updateFields._id;
  delete updateFields.projectId;
  const updated = await Projects.findOneAndUpdate(
    filter,
    { $set: updateFields },
    { new: true }
  ).exec();
  return updated ?? null;
};

export const updateProjectSharedWith = async (root, { projectId, sharedWith }) => {
    const filter = mongoose.Types.ObjectId.isValid(projectId)
        ? { _id: new mongoose.Types.ObjectId(projectId) }
        : { _id: projectId };
    const updated = await Projects.findOneAndUpdate(
        filter,
        { $set: { sharedWith: sharedWith ?? [] } },
        { new: true }
    );
    return updated ?? null;
}

/** Sets a project's outline (updates project document). */
export const setProjectOutline = (root, { input }) => {
  const newOutline = new Projects({
    projectId: input.projectId,
    user: input.user,
    format: input.format,
  });
  newOutline.id = input._id;
  return updateData(Projects, { newOutline }, input.projectId);
};

/** Creates a standalone outline framework (user's saved template). */
export const createOutlineFramework = (root, { input }) => {
  const doc = new OutlineFrameworks({
    user: input.user,
    name: input.name,
    imageUrl: input.imageUrl || undefined,
    format: input.format,
  });
  return insertData(doc);
};

/** Updates a standalone outline framework by id. */
export const updateOutlineFramework = (root, { id, input }) => {
  const filter = mongoose.Types.ObjectId.isValid(id)
    ? { _id: new mongoose.Types.ObjectId(id) }
    : { id };
  return OutlineFrameworks.findOneAndUpdate(
    filter,
    {
      name: input.name,
      imageUrl: input.imageUrl,
      format: input.format,
    },
    { new: true }
  ).exec();
};

/** Deletes a standalone outline framework by MongoDB _id (ObjectId string). */
export const deleteOutlineFramework = async (root, { id }: { id: string }) => {
  return deleteData(OutlineFrameworks, id);
};

export const createinspiration = async (root, { input }) => {
  const filter = mongoose.Types.ObjectId.isValid(input.projectId)
    ? { _id: new mongoose.Types.ObjectId(input.projectId) }
    : { _id: input.projectId };

  const payload = {
    projectId: String(input.projectId),
    title: input.title,
    image: input.image ?? null,
    video: input.video ?? null,
    note: input.note ?? null,
    links: input.links ?? [],
  };

  const updated = await Projects.findOneAndUpdate(
    filter,
    { $push: { inspiration: payload } },
    { new: true }
  ).exec();

  return updated;
};

/**
 * Records `writingTracker.currentPageCount` when the project's tracker is enabled.
 *
 * The page total itself now lives on the screenplay document row (`Screenplays.pageCount`), written
 * by `saveScreenplayDocument`, because each document paginates independently. The tracker still
 * follows the primary document only — it measures progress on the project's main draft, not on
 * every imported reference script.
 */
export const persistWritingTrackerCurrentPageCount = async (
  projectId: string,
  clampedPageCount: number
) => {
  const filter = mongoose.Types.ObjectId.isValid(projectId)
    ? { _id: new mongoose.Types.ObjectId(projectId) }
    : { _id: projectId };

  return Projects.findOneAndUpdate(
    { ...filter, 'writingTracker.enabled': true },
    { $set: { 'writingTracker.currentPageCount': clampedPageCount } },
    { new: true }
  ).exec();
};

export const saveScreenplay = async (
  root: unknown,
  args: {
    projectId: string;
    documentId?: string | null;
    content: unknown;
    estimatedPageCount?: number | null;
    layout?: unknown;
    /** Set by the PDF import paths so stale Yjs state does not overwrite the imported content. */
    resetCollaboration?: boolean;
  }
) => {
  const { projectId, documentId, content, estimatedPageCount, layout, resetCollaboration } = args;

  // Omitting documentId targets the project's primary document, which is what every pre-existing
  // caller (the editor's autosave, the create-project import) does.
  const target = await resolveScreenplayDocument(projectId, documentId ?? null);

  const clamped =
    estimatedPageCount != null && Number.isFinite(Number(estimatedPageCount))
      ? Math.min(99999, Math.max(1, Math.round(Number(estimatedPageCount))))
      : null;

  const saved = await saveScreenplayDocument(projectId, String(target._id), {
    content,
    // Only forward `layout` when the caller actually sent it: layout-less autosaves must preserve
    // the geometry inferred at import time.
    ...('layout' in args ? { layout } : {}),
    ...(clamped != null ? { pageCount: clamped } : {}),
    ...(resetCollaboration ? { resetCollaboration: true } : {}),
  });

  // The writing tracker measures the project's main draft only.
  if (clamped != null && target.isPrimary) {
    await persistWritingTrackerCurrentPageCount(projectId, clamped);
  }

  return saved;
};

export const createFeedback = (root, { input })  =>  {
    
}

export const lockAllScenesInOutline = async (_root: unknown, { projectId }: { projectId: string }) => {
  const result = await lockAllScenesForProject(projectId);
  return { lockedCount: result.lockedCount };
};

export const lockAllCharacters = async (_root: unknown, { projectId }: { projectId: string }) => {
  const result = await lockAllCharactersForProject(projectId);
  return { lockedCount: result.lockedCount };
};

export const unlockOutlineSection = async (_root: unknown, { projectId }: { projectId: string }) => {
  await unlockOutlineSectionService(projectId);
  return Projects.findById(projectId).exec();
};

export const unlockCharactersSection = async (_root: unknown, { projectId }: { projectId: string }) => {
  await unlockCharactersSectionService(projectId);
  return Projects.findById(projectId).exec();
};

export const deleteinspiration = async (root, { projectId, inspirationId }: { projectId: string; inspirationId: string }) => {
  const filter = mongoose.Types.ObjectId.isValid(projectId)
    ? { _id: new mongoose.Types.ObjectId(projectId) }
    : { _id: projectId };

  const inspoFilter = mongoose.Types.ObjectId.isValid(inspirationId)
    ? { _id: new mongoose.Types.ObjectId(inspirationId) }
    : { _id: inspirationId };

  const updated = await Projects.findOneAndUpdate(
    filter,
    { $pull: { inspiration: inspoFilter } },
    { new: true }
  ).exec();

  return updated;
};