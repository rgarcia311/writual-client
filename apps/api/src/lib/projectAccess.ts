import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Projects } from '@writual/db';

/**
 * Throws FORBIDDEN if the caller does not have write (edit) access to the project.
 * Owners always pass. Legacy sharedWith entries are treated as edit access.
 * New collaborators must have permissionLevel 'edit' and status 'active'.
 */
export async function verifyProjectWriteAccess(projectId: string, uid: string): Promise<void> {
  const project = await Projects.findOne({
    _id: new mongoose.Types.ObjectId(projectId),
    $or: [
      { user: uid },
      { sharedWith: uid },
      { collaborators: { $elemMatch: { uid, status: 'active', permissionLevel: 'edit' } } },
    ],
  }).lean().exec();

  if (!project) {
    throw new GraphQLError('Forbidden: you do not have edit access to this project', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

/**
 * Throws FORBIDDEN unless the caller may comment on the project. Owners and legacy `sharedWith`
 * entries pass; collaborators must be active with permissionLevel 'edit' or 'comment'.
 * Returns `isOwner` so callers can let owners moderate other people's feedback.
 */
export async function verifyProjectCommentAccess(
  projectId: string,
  uid: string
): Promise<{ isOwner: boolean }> {
  const project = await Projects.findOne(
    {
      _id: new mongoose.Types.ObjectId(projectId),
      $or: [
        { user: uid },
        { sharedWith: uid },
        {
          collaborators: {
            $elemMatch: { uid, status: 'active', permissionLevel: { $in: ['edit', 'comment'] } },
          },
        },
      ],
    },
    { user: 1 }
  ).lean().exec();

  if (!project) {
    throw new GraphQLError('Forbidden: you do not have comment access to this project', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return { isOwner: (project as any).user === uid };
}
