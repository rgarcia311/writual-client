import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Projects } from "@writual/db";
import { toObjectId, nowIso } from "../utils/mongoUtils";

/**
 * Logline iteration history. Every entry lives on the project document (`project.loglineHistory`);
 * the entry flagged `current` mirrors `project.logline`, which stays the source of truth for the
 * rest of the app. All writes are single-document updates, so no transaction is involved.
 */

export const MAX_LOGLINE_LENGTH = 1000;
export const MAX_FEEDBACK_LENGTH = 2000;

/** Who is performing the write; the display name is denormalized onto the entry. */
export interface LoglineActor {
  uid: string;
  displayName?: string | null;
}

export interface LoglineFeedbackDoc {
  _id: mongoose.Types.ObjectId;
  authorUid: string;
  authorName: string;
  text: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoglineVersionDoc {
  _id: mongoose.Types.ObjectId;
  text: string;
  authorUid: string | null;
  authorName: string;
  current: boolean;
  feedback: LoglineFeedbackDoc[];
  createdAt?: Date;
  updatedAt?: Date;
}

function badInput(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

function notFound(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

/** Rethrows a driver/validation failure with context instead of letting it surface bare. */
function wrapDbError(action: string, error: unknown): never {
  if (error instanceof GraphQLError) throw error;
  console.error(`[LoglineService] ${action} failed`, error);
  throw new GraphQLError(`Failed to ${action}`, {
    extensions: { code: "INTERNAL_SERVER_ERROR" },
    originalError: error instanceof Error ? error : undefined,
  });
}

function requireText(raw: string, max: number, label: string): string {
  const text = (raw ?? "").trim();
  if (!text) throw badInput(`${label} cannot be empty`);
  if (text.length > max) throw badInput(`${label} must be ${max} characters or fewer`);
  return text;
}

/**
 * Newest first, with the `current` flag resolved: an explicit flag wins, and when a partially
 * applied write leaves several (or none) flagged, the newest entry is treated as current.
 */
function normalize(history: unknown): LoglineVersionDoc[] {
  const rows = Array.isArray(history) ? [...(history as LoglineVersionDoc[])] : [];
  rows.sort((a, b) => {
    const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
  const flagged = rows.filter((row) => row?.current);
  const currentId = String((flagged[0] ?? rows[0])?._id ?? "");
  return rows.map((row) => ({
    ...row,
    feedback: Array.isArray(row?.feedback) ? row.feedback : [],
    current: String(row?._id ?? "") === currentId,
  }));
}

async function loadProject(projectId: string) {
  const project = await Projects.findById(toObjectId(projectId)).lean().exec();
  if (!project) throw notFound("Project not found");
  return project as any;
}

/** The project's history, newest first. */
export async function getLoglineHistory(projectId: string): Promise<LoglineVersionDoc[]> {
  try {
    return normalize((await loadProject(projectId)).loglineHistory);
  } catch (error) {
    wrapDbError("read logline history", error);
  }
}

/**
 * Writes the project's existing `logline` into the history as its first entry.
 * Idempotent and race-safe: the filter requires the array to still be empty, so a concurrent
 * second call matches nothing rather than creating a duplicate.
 */
export async function seedLoglineHistory(projectId: string): Promise<LoglineVersionDoc[]> {
  try {
    const pid = toObjectId(projectId);
    const project = await loadProject(projectId);
    const existing = (project.logline ?? "").trim();

    if (existing && (project.loglineHistory ?? []).length === 0) {
      await Projects.updateOne(
        {
          _id: pid,
          $or: [{ loglineHistory: { $size: 0 } }, { loglineHistory: { $exists: false } }],
        },
        {
          $push: {
            loglineHistory: {
              text: existing.slice(0, MAX_LOGLINE_LENGTH),
              authorUid: project.user ?? null,
              authorName: project.displayName ?? "",
              current: true,
              feedback: [],
            },
          },
        }
      ).exec();
    }

    return getLoglineHistory(projectId);
  } catch (error) {
    wrapDbError("seed logline history", error);
  }
}

/**
 * Adds a new iteration and makes it current, mirroring it into `project.logline`.
 * The push (with `current: true`) lands before the older entries are un-flagged, so a failure
 * between the two updates leaves an extra flag — which `normalize` resolves — rather than a
 * history with no current entry.
 */
export async function addLoglineVersion(
  projectId: string,
  rawText: string,
  actor: LoglineActor
): Promise<LoglineVersionDoc[]> {
  const text = requireText(rawText, MAX_LOGLINE_LENGTH, "Logline");
  try {
    const pid = toObjectId(projectId);
    // Keep the pre-existing logline in the history before it is replaced.
    await seedLoglineHistory(projectId);

    const versionId = new mongoose.Types.ObjectId();
    await Projects.updateOne(
      { _id: pid },
      {
        $push: {
          loglineHistory: {
            _id: versionId,
            text,
            authorUid: actor.uid,
            authorName: actor.displayName ?? "",
            current: true,
            feedback: [],
          },
        },
        $set: { logline: text, modified_date: nowIso() },
      }
    ).exec();

    await Projects.updateOne(
      { _id: pid },
      { $set: { "loglineHistory.$[other].current": false } },
      { arrayFilters: [{ "other._id": { $ne: versionId } }] }
    ).exec();

    return getLoglineHistory(projectId);
  } catch (error) {
    wrapDbError("add logline version", error);
  }
}

/** Edits one iteration in place; when it is the current one, `project.logline` follows. */
export async function updateLoglineVersion(
  projectId: string,
  versionId: string,
  rawText: string
): Promise<LoglineVersionDoc[]> {
  const text = requireText(rawText, MAX_LOGLINE_LENGTH, "Logline");
  try {
    const pid = toObjectId(projectId);
    const vid = toObjectId(versionId);

    const result = await Projects.updateOne(
      { _id: pid },
      { $set: { "loglineHistory.$[v].text": text, modified_date: nowIso() } },
      { arrayFilters: [{ "v._id": vid }] }
    ).exec();
    if (result.matchedCount === 0) throw notFound("Project not found");

    const history = await getLoglineHistory(projectId);
    const edited = history.find((row) => String(row._id) === String(vid));
    if (!edited) throw notFound("Logline version not found");
    if (edited.current) {
      await Projects.updateOne({ _id: pid }, { $set: { logline: text } }).exec();
    }
    return history;
  } catch (error) {
    wrapDbError("update logline version", error);
  }
}

/**
 * Removes one iteration. Deleting the current entry promotes the newest survivor (and mirrors it
 * into `project.logline`); deleting the last entry clears the project logline.
 */
export async function deleteLoglineVersion(
  projectId: string,
  versionId: string
): Promise<LoglineVersionDoc[]> {
  try {
    const pid = toObjectId(projectId);
    const vid = toObjectId(versionId);

    const before = await getLoglineHistory(projectId);
    const target = before.find((row) => String(row._id) === String(vid));
    if (!target) throw notFound("Logline version not found");

    await Projects.updateOne(
      { _id: pid },
      { $pull: { loglineHistory: { _id: vid } }, $set: { modified_date: nowIso() } }
    ).exec();

    if (target.current) {
      const remaining = await getLoglineHistory(projectId);
      const promoted = remaining[0];
      if (promoted) {
        return setCurrentLoglineVersion(projectId, String(promoted._id));
      }
      await Projects.updateOne({ _id: pid }, { $set: { logline: "" } }).exec();
    }

    return getLoglineHistory(projectId);
  } catch (error) {
    wrapDbError("delete logline version", error);
  }
}

/** Promotes an older iteration back to current and mirrors it into `project.logline`. */
export async function setCurrentLoglineVersion(
  projectId: string,
  versionId: string
): Promise<LoglineVersionDoc[]> {
  try {
    const pid = toObjectId(projectId);
    const vid = toObjectId(versionId);

    const history = await getLoglineHistory(projectId);
    const target = history.find((row) => String(row._id) === String(vid));
    if (!target) throw notFound("Logline version not found");

    await Projects.updateOne(
      { _id: pid },
      {
        $set: {
          "loglineHistory.$[all].current": false,
          logline: target.text,
          modified_date: nowIso(),
        },
      },
      { arrayFilters: [{ "all._id": { $exists: true } }] }
    ).exec();

    await Projects.updateOne(
      { _id: pid },
      { $set: { "loglineHistory.$[v].current": true } },
      { arrayFilters: [{ "v._id": vid }] }
    ).exec();

    return getLoglineHistory(projectId);
  } catch (error) {
    wrapDbError("set current logline version", error);
  }
}

/** Appends feedback to one iteration, attributed to the caller. */
export async function addLoglineFeedback(
  projectId: string,
  versionId: string,
  rawText: string,
  actor: LoglineActor
): Promise<LoglineVersionDoc[]> {
  const text = requireText(rawText, MAX_FEEDBACK_LENGTH, "Feedback");
  try {
    const vid = toObjectId(versionId);
    // The filter already pins the version, so `$` targets that entry's feedback array.
    const result = await Projects.updateOne(
      { _id: toObjectId(projectId), "loglineHistory._id": vid },
      {
        $push: {
          "loglineHistory.$.feedback": {
            authorUid: actor.uid,
            authorName: actor.displayName ?? "",
            text,
          },
        },
        $set: { modified_date: nowIso() },
      }
    ).exec();
    if (result.matchedCount === 0) throw notFound("Logline version not found");

    return getLoglineHistory(projectId);
  } catch (error) {
    wrapDbError("add logline feedback", error);
  }
}

/**
 * Removes one piece of feedback. Anyone may delete their own; only the project owner can remove
 * someone else's.
 */
export async function deleteLoglineFeedback(
  projectId: string,
  versionId: string,
  feedbackId: string,
  actorUid: string,
  isOwner: boolean
): Promise<LoglineVersionDoc[]> {
  try {
    const vid = toObjectId(versionId);
    const fid = toObjectId(feedbackId);
    // Non-owners may only remove feedback they wrote; the authorUid clause enforces that in the
    // same update, so there is no read-then-write gap.
    const match: Record<string, unknown> = isOwner ? { _id: fid } : { _id: fid, authorUid: actorUid };

    const result = await Projects.updateOne(
      { _id: toObjectId(projectId), "loglineHistory._id": vid },
      { $pull: { "loglineHistory.$.feedback": match }, $set: { modified_date: nowIso() } }
    ).exec();
    if (result.matchedCount === 0) throw notFound("Logline version not found");
    if (result.modifiedCount === 0) {
      throw new GraphQLError(
        isOwner
          ? "Feedback not found"
          : "Forbidden: that feedback was already removed, or was written by someone else",
        { extensions: { code: isOwner ? "NOT_FOUND" : "FORBIDDEN" } }
      );
    }

    return getLoglineHistory(projectId);
  } catch (error) {
    wrapDbError("delete logline feedback", error);
  }
}
