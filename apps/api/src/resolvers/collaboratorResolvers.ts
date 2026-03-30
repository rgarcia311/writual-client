import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import { Projects, AppUsers } from '../db-connector';
import { adminAuth } from '../lib/firebase-admin';
import { sendEmail } from '../services/emailService';

// ─── inviteCollaborators ────────────────────────────────────────────────────

export async function inviteCollaborators(
  _: unknown,
  { projectId, invitations }: { projectId: string; invitations: Array<{ email: string; permissionLevel: string; aspects: string[] }> },
  context: { uid: string | null }
) {
  if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });

  const project = await Projects.findOne({ _id: projectId, user: context.uid }).lean().exec();
  if (!project) throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });

  const newCollaborators: any[] = [];
  const reinvites: any[] = [];

  for (const inv of invitations) {
    const email = inv.email.toLowerCase().trim();
    const existing = (project as any).collaborators?.find((c: any) => c.email === email);

    if (existing?.status === 'active') continue;

    if (existing?.status === 'pending') {
      reinvites.push({ email, newToken: randomUUID(), permissionLevel: inv.permissionLevel, aspects: inv.aspects });
      continue;
    }

    // Brand-new collaborator — check if they have a Firebase account
    let invitedUid: string | null = null;
    let isExistingUser = false;
    try {
      if (adminAuth) {
        const firebaseUser = await adminAuth.getUserByEmail(email);
        invitedUid = firebaseUser.uid;
        isExistingUser = true;
      }
    } catch { /* no account — pending */ }

    newCollaborators.push({
      email,
      uid: invitedUid,
      status: isExistingUser ? 'active' : 'pending',
      permissionLevel: inv.permissionLevel,
      aspects: inv.aspects,
      inviteToken: randomUUID(),
      invitedAt: new Date(),
    });
  }

  if (newCollaborators.length === 0 && reinvites.length === 0) {
    return project;
  }

  if (newCollaborators.length > 0) {
    await Projects.updateOne(
      { _id: projectId },
      { $push: { collaborators: { $each: newCollaborators } } }
    );
  }

  for (const r of reinvites) {
    await Projects.updateOne(
      { _id: projectId, 'collaborators.email': r.email },
      { $set: {
        'collaborators.$.inviteToken':     r.newToken,
        'collaborators.$.permissionLevel': r.permissionLevel,
        'collaborators.$.aspects':         r.aspects,
      } }
    );
  }

  const updatedProject = await Projects.findById(projectId).lean().exec();

  const inviter = await AppUsers.findOne({ uid: context.uid }).lean().exec() as any;
  const inviterDisplayName = inviter?.displayName ?? 'Someone';

  const allToEmail = [
    ...newCollaborators.map((c: any) => ({ email: c.email, token: c.inviteToken, status: c.status, permissionLevel: c.permissionLevel, aspects: c.aspects })),
    ...reinvites.map((r: any) => ({ email: r.email, token: r.newToken, status: 'pending', permissionLevel: r.permissionLevel, aspects: r.aspects })),
  ];

  for (const collab of allToEmail) {
    const templateKey = collab.status === 'active'
      ? 'app_notifications.project_share_invite_existing'
      : 'app_notifications.project_share_invite_new';

    await sendEmail(templateKey, collab.email, {
      inviterName:     inviterDisplayName,
      projectTitle:    (project as any).title ?? 'Untitled',
      aspects:         collab.aspects.join(', '),
      permissionLevel: collab.permissionLevel,
      inviteToken:     collab.token,
      projectId:       String(projectId),
    });
  }

  return updatedProject;
}

// ─── updateCollaborator ─────────────────────────────────────────────────────

export async function updateCollaborator(
  _: unknown,
  { projectId, collaboratorId, permissionLevel, aspects }: { projectId: string; collaboratorId: string; permissionLevel?: string; aspects?: string[] },
  context: { uid: string | null }
) {
  if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });

  const update: Record<string, any> = {};
  if (permissionLevel != null) update['collaborators.$[elem].permissionLevel'] = permissionLevel;
  if (aspects != null) update['collaborators.$[elem].aspects'] = aspects;

  const updated = await Projects.findOneAndUpdate(
    { _id: projectId, user: context.uid },
    { $set: update },
    {
      arrayFilters: [{ 'elem._id': new mongoose.Types.ObjectId(collaboratorId) }],
      new: true,
    }
  ).lean().exec();

  if (!updated) throw new GraphQLError('Forbidden or project not found', { extensions: { code: 'FORBIDDEN' } });
  return updated;
}

// ─── removeCollaborator ─────────────────────────────────────────────────────

export async function removeCollaborator(
  _: unknown,
  { projectId, collaboratorId }: { projectId: string; collaboratorId: string },
  context: { uid: string | null }
) {
  if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });

  const updated = await Projects.findOneAndUpdate(
    { _id: projectId, user: context.uid },
    { $pull: { collaborators: { _id: new mongoose.Types.ObjectId(collaboratorId) } } },
    { new: true }
  ).lean().exec();

  if (!updated) throw new GraphQLError('Forbidden or project not found', { extensions: { code: 'FORBIDDEN' } });
  return updated;
}

// ─── claimInvite ────────────────────────────────────────────────────────────

export async function claimInvite(
  _: unknown,
  { token }: { token: string },
  context: { uid: string | null }
) {
  if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
  if (!adminAuth) throw new GraphQLError('Auth service unavailable', { extensions: { code: 'INTERNAL' } });

  const firebaseUser = await adminAuth.getUser(context.uid);
  const callerEmail = firebaseUser.email?.toLowerCase().trim();
  if (!callerEmail) throw new GraphQLError('No email on account', { extensions: { code: 'BAD_REQUEST' } });

  const project = await Projects.findOne({ 'collaborators.inviteToken': token }).lean().exec() as any;
  if (!project) throw new GraphQLError('Invalid or expired invite token', { extensions: { code: 'NOT_FOUND' } });

  const collaborator = project.collaborators?.find((c: any) => c.inviteToken === token);
  if (!collaborator || collaborator.email !== callerEmail) {
    throw new GraphQLError('This invite was not sent to your email address', { extensions: { code: 'FORBIDDEN' } });
  }

  const updated = await Projects.findOneAndUpdate(
    { _id: project._id, 'collaborators.inviteToken': token },
    { $set: {
      'collaborators.$.uid':         context.uid,
      'collaborators.$.status':      'active',
      'collaborators.$.inviteToken': null,
    } },
    { new: true }
  ).lean().exec();

  return updated;
}

// ─── finalizeSignup ─────────────────────────────────────────────────────────

export async function finalizeSignup(
  _: unknown,
  __: unknown,
  context: { uid: string | null }
) {
  if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
  if (!adminAuth) return false;

  try {
    const firebaseUser = await adminAuth.getUser(context.uid);
    const email = firebaseUser.email?.toLowerCase().trim();
    if (!email) return false;

    // Persist email to AppUsers
    await AppUsers.updateOne({ uid: context.uid }, { $set: { email } });

    // Claim all pending project invitations for this email
    await Projects.updateMany(
      { collaborators: { $elemMatch: { email, status: 'pending' } } },
      {
        $set: {
          'collaborators.$[elem].uid':         context.uid,
          'collaborators.$[elem].status':      'active',
          'collaborators.$[elem].inviteToken': null,
        },
      },
      { arrayFilters: [{ 'elem.email': email, 'elem.status': 'pending' }] }
    );

    return true;
  } catch {
    // Non-blocking — do not fail if Firebase Admin is unavailable
    return false;
  }
}
