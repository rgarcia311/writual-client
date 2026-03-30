import { GraphQLJSON } from "graphql-scalars";
import { getProjectData, getOutlineFrameworks } from "../resolvers";
import { setProjectOutline, createOutlineFramework, updateOutlineFramework, deleteOutlineFramework, createProject, deleteProject, shareProject, updateProject, updateProjectSharedWith, createinspiration, deleteinspiration, lockAllScenesInOutline, lockAllCharacters, unlockOutlineSection, unlockCharactersSection, saveScreenplay as saveScreenplayFn } from "../mutations";
import mongoose from "mongoose";
import { AppUsers, Projects, Messages, Conversations } from "../db-connector";
import { requireTier } from "../utils/tierUtils";
import { pusher } from "../services/pusher";
import { inviteCollaborators, updateCollaborator, removeCollaborator, claimInvite, finalizeSignup } from "../resolvers/collaboratorResolvers";
import { verifyProjectWriteAccess } from "../lib/projectAccess";
export const ProjectType = `#graphql

    scalar JSON

    type UserSettings {
        colorMode: String!
    }

    type User {
        uid: String!
        name: String
        displayName: String
        tier: String!
        settings: UserSettings!
    }

    type Query {
        getProjectData(input: ProjectFilters): [Project]
        getOutlineFrameworks(user: String!): [OutlineFramework]
        me(displayName: String, name: String): User
        getProjectMessages(conversationId: ID!, limit: Int, offset: Int): [Message]
        getProjectChats: [ChatThread]
        getProjectConversations(projectId: ID!): [ConversationThread]
    }

    type Message {
        _id: String!
        text: String!
        senderId: String!
        projectId: String!
        createdAt: String
        clientGeneratedId: String
        sender: User
    }

    type DevelopmentStatus {
        outlineStarted: Boolean!
        charactersStarted: Boolean!
        treatmentStarted: Boolean!
        screenplayStarted: Boolean!
    }

    type Collaborator {
        _id: String!
        email: String!
        uid: String
        status: String!
        permissionLevel: String!
        aspects: [String!]!
        invitedAt: String
    }

    input InvitationInput {
        email: String!
        permissionLevel: String!
        aspects: [String!]!
    }

    type ChatThread {
        _id: String!
        title: String!
        displayName: String
        ownerDisplayName: String
        user: String
        genre: String
        type: String
        poster: String
        sharedWith: [String]
        collaborators: [Collaborator]
        createdAt: String
        developmentStatus: DevelopmentStatus!
        lastMessage: Message
        unreadCount: Int!
    }

    type ConversationParticipant {
        uid: String!
        displayName: String
        name: String
    }

    type ConversationThread {
        _id: String!
        projectId: String!
        type: String!
        name: String
        participants: [ConversationParticipant!]!
        lastMessage: Message
        unreadCount: Int!
    }

    type Mutation {
        setProjectOutline(input: OutlineInput): Outline
        createOutlineFramework(input: OutlineFrameworkInput!): OutlineFramework
        updateOutlineFramework(id: String!, input: OutlineFrameworkInput!): OutlineFramework
        deleteOutlineFramework(id: String!): String
        createProject(input: ProjectInput): Project
        deleteProject(id: String): String
        shareProject(id: String, user: String): Project
        updateProject(project: ProjectInput): Project
        updateProjectSharedWith(projectId: String!, sharedWith: [String]): Project
        createinspiration(input: inspirationInput!): Project
        deleteinspiration(projectId: String!, inspirationId: String!): Project
        saveScreenplay(projectId: ID!, content: JSON!): Screenplay
        lockAllScenesInOutline(projectId: String!): LockAllScenesResult
        lockAllCharacters(projectId: String!): LockAllCharactersResult
        unlockOutlineSection(projectId: String!): Project
        unlockCharactersSection(projectId: String!): Project
        sendMessage(conversationId: ID!, text: String!, clientGeneratedId: String): Message
        markAsRead(conversationId: ID!): Boolean
        createGroupConversation(projectId: ID!, participantUids: [String!]!, name: String!): ConversationThread
        leaveConversation(conversationId: ID!): Boolean
        inviteCollaborators(projectId: ID!, invitations: [InvitationInput!]!): Project
        updateCollaborator(projectId: ID!, collaboratorId: ID!, permissionLevel: String, aspects: [String!]): Project
        removeCollaborator(projectId: ID!, collaboratorId: ID!): Project
        claimInvite(token: String!): Project
        finalizeSignup: Boolean
    }

    type ProjectStats {
        totalScenes: Int
        lockedScenes: Int
        totalCharacters: Int
        lockedCharacters: Int
    }

    type LockAllScenesResult {
        lockedCount: Int
    }

    type LockAllCharactersResult {
        lockedCount: Int
    }

    type Project {
        _id: String!
        created_date: String
        modified_date: String
        revision: Int
        user: String!
        displayName: String
        email: String
        sharedWith: [String]
        collaborators: [Collaborator]
        type: ProjectType
        timePeriod: String
        genre: String
        title: String!
        logline: String
        budget: Int
        poster: String
        similarProjects: [String]
        outlineName: String
        scenes: [Scene]
        characters: [Character]
        outline: Outline
        inspiration: [inspiration]
        treatment: Treatment
        screenplay: Screenplay
        feedback: Feedback
        stats: ProjectStats
        pageCountEstimate: Int
        outlineSectionLocked: Boolean
        charactersSectionLocked: Boolean
        activeVersion: Int
        lockedVersion: Int
    }

    input ProjectFilters {
        _id: String
        created_date: String
        modified_date: String
        revision: Int
        user: String!
        displayName: String
        email: String
        sharedWith: [String]
        type: ProjectType
        timePeriod: String
        genre: String
        title: String
        logline: String
        budget: Int
        poster: String
        similarProjects: [String]
        outlineName: String
        scenes: [SceneInput]
        characters: [CharacterInput]
        outline: OutlineInput
        inspiration: [inspirationInput]
        treatment: TreatmentInput
        screenplay: ScreenplayInput
        feedback: FeedbackInput
    }

    input ProjectFilters {
        filters: ProjectFilters
    }

    input ProjectInput {
        _id: String
        user: String!
        displayName: String
        email: String
        projectId: String
        sharedWith: [String]
        type: ProjectType
        genre: String
        timePeriod: String
        title: String!
        logline: String
        budget: Int
        poster: String
        similarProjects: [String]
        outlineName: String
        scenes: [SceneInput]
        characters: [CharacterInput]
        outline: OutlineInput
        inspiration: [inspirationInput]
        treatment: TreatmentInput
        screenplay: ScreenplayInput
        feedback: FeedbackInput
        stats: ProjectStatsInput
        pageCountEstimate: Int
        outlineSectionLocked: Boolean
        charactersSectionLocked: Boolean
        activeVersion: Int
        lockedVersion: Int
    }

    input ProjectStatsInput {
        totalScenes: Int
        lockedScenes: Int
        totalCharacters: Int
        lockedCharacters: Int
    }

    type Feedback  {
        projectId: String
        user: String
        feedback_content: FeedbackContent
    }

    type FeedbackContent {
        text: String
        revision: Int
    }

    input FeedbackContentInput {
        text: String
        revision: Int
    }

    input FeedbackInput {
        user: String
        feedback_content: FeedbackContentInput
    }

    type SceneContent {
        thesis: String
        antithesis: String
        synthesis: String 
        synopsis: String
        version: Int
        act: Int
        step: String
        sceneHeading: String
        locked: Boolean
    }

    input SceneContentInput {
        thesis: String
        antithesis: String
        synthesis: String 
        synopsis: String
        version: Int
        act: Int
        step: String
        sceneHeading: String
        locked: Boolean
    }

    type Scene {
        _id: String!
        projectId: String
        activeVersion: Int
        lockedVersion: Int
        newVersion: Boolean
        newScene: Boolean
        versions: [SceneContent]
    }

    input SceneInput {
        _id: String
        activeVersion: Int
        lockedVersion: Int
        newVersion: Boolean
        newScene: Boolean
        versions: [SceneContentInput]
    }

    type Character {
        _id: String
        projectId: String
        name: String
        imageUrl: String
        details: [CharacterDetails]
        activeVersion: Int
        lockedVersion: Int
    }

    type CharacterDetails {
        version: Int
        name: String
        gender: String
        age: Int
        bio: String
        need: String
        want: String
    }

    input CharacterDetailsInput {
        version: Int
        gender: String
        age: Int
        bio: String
        need: String
        want: String
    }

    input CharacterInput {
        _id: String
        name: String
        imageUrl: String
        details: [CharacterDetailsInput]
    }

    enum ProjectType {
        Film
        Feature 
        Television
        Short 
    }

    type Treatment {
        projectId: String
        versions: [TreatmentContent]
        lockedVersion: Int
    }

    input TreatmentInput {
        versions: [TreatmentContentInput]
    }

    type TreatmentContent {
        version: Int
        text: String
    }

    input TreatmentContentInput {
        version: Int
        text: String
    }

    type Screenplay {
        projectId: String
        versions: [ScreenplayContent]
        lockedVersion: Int
    }

    type  ScreenplayContent  {
        version: Int
        content: JSON
    }

    input ScreenplayInput {
        version: Int
        content: JSON
    }

    type inspiration  {
        _id: String!
        projectId: String!
        title: String!
        image: String
        video: String
        note: String
        links: [String]
    }

    input inspirationInput  {
        projectId: String!
        title: String!
        image: String
        video: String
        note: String
        links: [String]
    }

    type Outline {
        projectId: String
        user: String
        format: OutlineFormat
    }

    type OutlineFramework {
        _id: String!
        id: String!
        user: String!
        name: String!
        imageUrl: String
        format: OutlineFormat
    }

    input OutlineInput {
        user: String!
        format: OutlineFormatInput
    }

    input OutlineFrameworkInput {
        user: String!
        name: String!
        imageUrl: String
        format: OutlineFormatInput!
    }

    type OutlineFormat {
            format_id: String
            name: String
            steps: [OutlineSteps]
    }

    input OutlineFormatInput {
        name: String
        steps: [OutlineStepsInput]
    }

    type OutlineSteps {
            step_id: String
            name: String
            number: Int
            act: String
            instructions: String
    }

    input OutlineStepsInput {
            name: String
            number: Int
            act: String
            instructions: String
    }
   
   
`;

export const resolvers = {
  Query: {
    getProjectData,
    getOutlineFrameworks,
    getProjectMessages: async (_root: unknown, { conversationId, limit = 50, offset = 0 }: { conversationId: string; limit?: number; offset?: number }, context: { uid: string | null; user: any }) => {
      if (!context.uid || !context.user) throw new Error('Unauthorized');
      if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new Error('Invalid conversationId');

      const conv = await Conversations.findById(conversationId).lean().exec();
      if (!conv || !(conv as any).participants.includes(context.uid)) {
        throw new Error('Forbidden: You do not have access to this conversation');
      }

      return Messages.find({ conversationId: new mongoose.Types.ObjectId(conversationId) })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('senderId')
        .lean()
        .exec();
    },
    getProjectConversations: async (_: any, { projectId }: { projectId: string }, context: any) => {
      if (!context.uid || !context.user) throw new Error('Unauthorized');
      if (!mongoose.Types.ObjectId.isValid(projectId)) throw new Error('Invalid projectId');

      const project = await Projects.findOne({
        _id: new mongoose.Types.ObjectId(projectId),
        $or: [
          { user: context.uid },
          { sharedWith: context.uid },
          { collaborators: { $elemMatch: { uid: context.uid, status: 'active' } } },
        ],
      }).lean().exec();
      if (!project) throw new Error('Forbidden');

      const p = project as any;
      const sharedWith: string[] = p.sharedWith ?? [];
      const collabUids: string[] = (p.collaborators ?? [])
        .filter((c: any) => c.status === 'active' && c.uid)
        .map((c: any) => c.uid);
      const allMemberUids: string[] = [...new Set([p.user, ...sharedWith, ...collabUids].filter(Boolean) as string[])];

      // Upsert DMs only for missing pairs (optimization)
      const otherMemberUids = allMemberUids.filter((uid) => uid !== context.uid);
      if (otherMemberUids.length > 0) {
        const existingDms = await Conversations.find({
          projectId: new mongoose.Types.ObjectId(projectId),
          type: 'direct',
          participants: context.uid,
        }, { conversationKey: 1 }).lean().exec();
        const existingDmKeys = new Set((existingDms as any[]).map((c) => c.conversationKey));

        const missingUids = otherMemberUids.filter((otherUid) => {
          const key = `${projectId}:direct:${[context.uid, otherUid].sort().join(':')}`;
          return !existingDmKeys.has(key);
        });

        if (missingUids.length > 0) {
          await Promise.all(missingUids.map(async (otherUid) => {
            const sorted = [context.uid, otherUid].sort();
            const key = `${projectId}:direct:${sorted.join(':')}`;
            try {
              await Conversations.findOneAndUpdate(
                { conversationKey: key },
                {
                  $setOnInsert: {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    type: 'direct',
                    name: null,
                    participants: sorted,
                    conversationKey: key,
                  },
                },
                { upsert: true, new: true }
              );
            } catch (e: any) {
              if (e.code !== 11000) throw e;
              // Duplicate key: already exists, safe to ignore
            }
          }));
        }
      }

      // Fetch all conversations for this project where user is a participant
      const conversations = await Conversations.find({
        projectId: new mongoose.Types.ObjectId(projectId),
        participants: context.uid,
      }).lean().exec();

      // Bulk-fetch participant user objects
      const allUids = [...new Set((conversations as any[]).flatMap((c) => c.participants))];
      const users = await AppUsers.find({ uid: { $in: allUids } }, { uid: 1, displayName: 1, name: 1 }).lean().exec();
      const userMap: Record<string, any> = {};
      for (const u of users as any[]) { userMap[u.uid] = u; }

      // Compute lastMessage per conversation
      const conversationIds = (conversations as any[]).map((c) => c._id);
      const lastMessageAgg = conversationIds.length > 0
        ? await Messages.aggregate([
            { $match: { conversationId: { $in: conversationIds } } },
            { $sort: { conversationId: 1, createdAt: -1 } },
            { $group: { _id: '$conversationId', doc: { $first: '$$ROOT' } } },
            {
              $lookup: {
                from: 'appusers',
                localField: 'doc.senderId',
                foreignField: '_id',
                as: 'senderArr',
              },
            },
            { $addFields: { 'doc.sender': { $arrayElemAt: ['$senderArr', 0] } } },
            { $project: { senderArr: 0 } },
          ])
        : [];

      const lastMessageMap: Record<string, any> = {};
      for (const row of lastMessageAgg) {
        lastMessageMap[String(row._id)] = row.doc;
      }

      // Compute unread counts
      const appUser = await AppUsers.findOne({ uid: context.uid }, { 'settings.lastReadByConversation': 1 }).lean().exec();
      const lastReadMap: Record<string, Date> = (appUser as any)?.settings?.lastReadByConversation ?? {};

      const unreadAgg = conversationIds.length > 0
        ? await Messages.aggregate([
            {
              $match: {
                $or: conversationIds.map((cid: any) => ({
                  conversationId: cid,
                  createdAt: { $gt: lastReadMap[String(cid)] ?? new Date(0) },
                })),
              },
            },
            { $group: { _id: '$conversationId', count: { $sum: 1 } } },
          ])
        : [];

      const unreadByConversation: Record<string, number> = {};
      for (const row of unreadAgg) { unreadByConversation[String(row._id)] = row.count; }

      return (conversations as any[]).map((conv) => ({
        _id: String(conv._id),
        projectId: String(conv.projectId),
        type: conv.type,
        name: conv.name ?? null,
        participants: (conv.participants as string[]).map((uid) => ({
          uid,
          displayName: userMap[uid]?.displayName ?? null,
          name: userMap[uid]?.name ?? null,
        })),
        lastMessage: lastMessageMap[String(conv._id)] ?? null,
        unreadCount: unreadByConversation[String(conv._id)] ?? 0,
      }));
    },
    getProjectChats: async (_: any, __: any, context: any) => {
      if (!context.uid || !context.user) throw new Error('Unauthorized');

      const results = await Projects.aggregate([
        { $match: { $or: [
          { user: context.uid },
          { sharedWith: context.uid },
          { collaborators: { $elemMatch: { uid: context.uid, status: 'active' } } },
        ] } },
        {
          $project: {
            _id: 1, title: 1, displayName: 1, genre: 1, type: 1, poster: 1,
            sharedWith: 1, collaborators: 1, stats: 1, treatment: 1, screenplay: 1, user: 1, createdAt: 1,
          },
        },
        {
          $lookup: {
            from: 'appusers',
            localField: 'user',
            foreignField: 'uid',
            as: 'ownerArr',
          },
        },
        {
          $addFields: {
            ownerDisplayName: {
              $ifNull: [
                { $arrayElemAt: ['$ownerArr.displayName', 0] },
                '$displayName',
              ],
            },
          },
        },
        { $project: { ownerArr: 0 } },
        {
          $lookup: {
            from: 'messages',
            let: { pid: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$projectId', '$$pid'] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
              {
                $lookup: {
                  from: 'appusers',
                  localField: 'senderId',
                  foreignField: '_id',
                  as: 'senderArr',
                },
              },
              { $addFields: { sender: { $arrayElemAt: ['$senderArr', 0] } } },
              { $project: { senderArr: 0 } },
            ],
            as: 'messages',
          },
        },
        { $addFields: { lastMessage: { $arrayElemAt: ['$messages', 0] } } },
        { $project: { messages: 0 } },
      ]);

      const appUser = await AppUsers.findOne({ uid: context.uid }, { 'settings.lastReadByProject': 1 }).lean().exec();
      const lastReadMap: Record<string, Date> = (appUser as any)?.settings?.lastReadByProject ?? {};

      const unreadAgg = results.length > 0
        ? await Messages.aggregate([
            {
              $match: {
                $or: results.map((p: any) => ({
                  projectId: p._id,
                  createdAt: { $gt: lastReadMap[String(p._id)] ?? new Date(0) },
                })),
              },
            },
            { $group: { _id: '$projectId', count: { $sum: 1 } } },
          ])
        : [];

      const unreadByProject: Record<string, number> = {};
      for (const row of unreadAgg) {
        unreadByProject[String(row._id)] = row.count;
      }

      return results.map((project: any) => ({
        ...project,
        developmentStatus: {
          outlineStarted: (project.stats?.totalScenes ?? 0) > 0,
          charactersStarted: (project.stats?.totalCharacters ?? 0) > 0,
          treatmentStarted: (project.treatment?.versions?.length ?? 0) > 0,
          screenplayStarted: (project.screenplay?.versions?.length ?? 0) > 0,
        },
        lastMessage: project.lastMessage ?? null,
        unreadCount: unreadByProject[String(project._id)] ?? 0,
      }));
    },
    me: async (
      _root: unknown,
      { displayName, name }: { displayName?: string; name?: string },
      context: { uid: string | null }
    ) => {
      if (!context.uid) throw new Error('Unauthorized');
      return AppUsers.findOneAndUpdate(
        { uid: context.uid },
        {
          $set: {
            // $set syncs Firebase display name on every login.
            // NOTE: if we add custom 'pen names' in the future, wrap these in a
            // "don't overwrite if user has customized" check before setting.
            ...(displayName != null && { displayName }),
            ...(name != null && { name }),
          },
          $setOnInsert: {
            uid: context.uid,
            tier: 'beta-access',
            settings: { colorMode: 'dark' },
          },
        },
        { upsert: true, new: true }
      ).exec();
    },
  },
  Mutation: {
    setProjectOutline,
    createOutlineFramework,
    updateOutlineFramework,
    deleteOutlineFramework,
    createProject,
    deleteProject,
    shareProject,
    updateProject: async (root: unknown, args: { project: { _id?: string } }, context: { uid: string | null }) => {
      if (args.project?._id) await verifyProjectWriteAccess(args.project._id, context.uid!);
      return updateProject(root, args);
    },
    updateProjectSharedWith,
    createinspiration,
    deleteinspiration,
    saveScreenplay: async (root: unknown, args: { projectId: string; content: unknown }, context: { uid: string | null }) => {
      await requireTier(context, 'spec');
      await verifyProjectWriteAccess(args.projectId, context.uid!);
      return saveScreenplayFn(root, args);
    },
    lockAllScenesInOutline,
    lockAllCharacters,
    unlockOutlineSection,
    unlockCharactersSection,
    inviteCollaborators,
    updateCollaborator,
    removeCollaborator,
    claimInvite,
    finalizeSignup,
    sendMessage: async (_root: unknown, { conversationId, text, clientGeneratedId }: { conversationId: string; text: string; clientGeneratedId?: string }, context: { uid: string | null; user: any }) => {
      if (!context.uid || !context.user) throw new Error('Unauthorized');
      if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new Error('Invalid conversationId');

      const conv = await Conversations.findById(conversationId).lean().exec();
      if (!conv || !(conv as any).participants.includes(context.uid)) {
        throw new Error('Forbidden: You do not have access to this conversation');
      }
      const projectId = (conv as any).projectId;

      const message = new Messages({
        text,
        senderId: context.user._id,
        projectId,
        conversationId: new mongoose.Types.ObjectId(conversationId),
      });
      const saved = await message.save();

      const result = saved.toObject() as any;
      result.sender = context.user;
      result.clientGeneratedId = clientGeneratedId ?? null;

      await pusher.trigger(`private-conversation-${conversationId}`, 'new-message', {
        _id: String(saved._id),
        text: saved.get('text'),
        senderId: String(saved.get('senderId')),
        projectId: String(saved.get('projectId')),
        createdAt: saved.get('createdAt'),
        sender: context.user,
        clientGeneratedId: clientGeneratedId ?? null,
      });

      return result;
    },
    markAsRead: async (_: any, { conversationId }: { conversationId: string }, context: any) => {
      if (!context.uid || !context.user) throw new Error('Unauthorized');
      if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new Error('Invalid conversationId');
      await AppUsers.updateOne(
        { uid: context.uid },
        { $set: { [`settings.lastReadByConversation.${conversationId}`]: new Date() } }
      );
      return true;
    },
    createGroupConversation: async (_: any, { projectId, participantUids, name }: { projectId: string; participantUids: string[]; name: string }, context: any) => {
      if (!context.uid || !context.user) throw new Error('Unauthorized');
      if (!mongoose.Types.ObjectId.isValid(projectId)) throw new Error('Invalid projectId');

      const project = await Projects.findOne({
        _id: new mongoose.Types.ObjectId(projectId),
        $or: [
          { user: context.uid },
          { sharedWith: context.uid },
          { collaborators: { $elemMatch: { uid: context.uid, status: 'active' } } },
        ],
      }).lean().exec();
      if (!project) throw new Error('Forbidden');

      const p = project as any;
      const sharedWith: string[] = p.sharedWith ?? [];
      const collabUids: string[] = (p.collaborators ?? [])
        .filter((c: any) => c.status === 'active' && c.uid)
        .map((c: any) => c.uid);
      const allMemberUids = new Set([p.user, ...sharedWith, ...collabUids].filter(Boolean) as string[]);

      for (const uid of participantUids) {
        if (!allMemberUids.has(uid)) throw new Error(`User ${uid} is not a member of this project`);
      }

      const participants = [...new Set([context.uid, ...participantUids])];
      const groupId = new mongoose.Types.ObjectId().toHexString();
      const conversationKey = `${projectId}:group:${groupId}`;

      const conv = new Conversations({
        projectId: new mongoose.Types.ObjectId(projectId),
        type: 'group',
        name: name.trim(),
        participants,
        conversationKey,
      });
      const saved = await conv.save();

      const users = await AppUsers.find({ uid: { $in: participants } }, { uid: 1, displayName: 1, name: 1 }).lean().exec();
      const userMap: Record<string, any> = {};
      for (const u of users as any[]) { userMap[u.uid] = u; }

      const result = {
        _id: String(saved._id),
        projectId: String((saved as any).projectId),
        type: (saved as any).type,
        name: (saved as any).name,
        participants: participants.map((uid) => ({
          uid,
          displayName: userMap[uid]?.displayName ?? null,
          name: userMap[uid]?.name ?? null,
        })),
        lastMessage: null,
        unreadCount: 0,
      };

      await pusher.trigger(`private-project-${projectId}`, 'new-conversation', result);
      return result;
    },
    leaveConversation: async (_: any, { conversationId }: { conversationId: string }, context: any) => {
      if (!context.uid || !context.user) throw new Error('Unauthorized');
      if (!mongoose.Types.ObjectId.isValid(conversationId)) throw new Error('Invalid conversationId');

      const conv = await Conversations.findById(conversationId).lean().exec();
      if (!conv) throw new Error('Conversation not found');
      if (!(conv as any).participants.includes(context.uid)) throw new Error('Forbidden');
      if ((conv as any).type === 'direct') throw new Error('Cannot leave a direct conversation');

      const updated = await Conversations.findByIdAndUpdate(
        conversationId,
        { $pull: { participants: context.uid } },
        { new: true }
      ).lean().exec();

      if (updated && (updated as any).participants.length === 0) {
        await Conversations.deleteOne({ _id: new mongoose.Types.ObjectId(conversationId) });
      }
      return true;
    },
  },
  Project: {
    scenes: (parent: any, _: any, context: { scenesLoader: { load: (id: string) => Promise<any[]> } }) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      return id ? context.scenesLoader.load(id) : [];
    },
    characters: (parent: any, _: any, context: { charactersLoader: { load: (id: string) => Promise<any[]> } }) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      return id ? context.charactersLoader.load(id) : [];
    },
  },
  Collaborator: {
    _id: (parent: any) => String(parent._id),
    invitedAt: (parent: any) => parent?.invitedAt != null ? String(parent.invitedAt) : null,
  },
  ChatThread: {
    _id: (parent: any) => String(parent._id),
  },
  ConversationThread: {
    _id: (parent: any) => String(parent._id),
    projectId: (parent: any) => String(parent.projectId),
  },
  Message: {
    _id: (parent: any) => (parent?._id != null ? String(parent._id) : ""),
    senderId: (parent: any) => (parent?.senderId != null ? String(parent.senderId) : ""),
    projectId: (parent: any) => (parent?.projectId != null ? String(parent.projectId) : ""),
    createdAt: (parent: any) => (parent?.createdAt != null ? String(parent.createdAt) : null),
    clientGeneratedId: (parent: any) => parent?.clientGeneratedId ?? null,
    sender: async (parent: any) => {
      // Already populated via .populate('senderId') in getProjectMessages
      if (parent?.senderId && typeof parent.senderId === 'object' && parent.senderId.uid) {
        return parent.senderId;
      }
      // Attached directly from context in sendMessage
      if (parent?.sender) return parent.sender;
      // Fallback: fetch by ObjectId
      if (parent?.senderId) {
        return AppUsers.findById(parent.senderId).lean().exec();
      }
      return null;
    },
  },
  Scene: {
    _id: (parent: any) => (parent?._id != null ? String(parent._id) : ""),
  },
  Character: {
    _id: (parent: any) => (parent?._id != null ? String(parent._id) : null),
    projectId: (parent: any) => (parent?.projectId != null ? String(parent.projectId) : null),
    name: (parent: any) => parent?.details?.[0]?.name ?? parent?.name ?? null,
    imageUrl: (parent: any) => parent?.imageUrl ?? null,
    activeVersion: (parent: any) => parent?.activeVersion ?? 1,
    lockedVersion: (parent: any) => parent?.lockedVersion ?? null,
    details: (parent: any) => {
      const d = parent?.details;
      if (!Array.isArray(d)) return [];
      return d.map((detail: any) => ({
        version: detail?.version,
        gender: detail?.gender ?? null,
        age: detail?.age,
        bio: detail?.bio ?? null,
        need: detail?.need ?? null,
        want: detail?.want ?? null,
        name: detail?.name ?? null,
      }));
    },
  },
  OutlineFramework: {
    _id: (doc: any) => (doc?._id != null ? String(doc._id) : String(doc?.id ?? "")),
    id: (doc: any) => (doc?.id != null && String(doc.id).length ? String(doc.id) : String(doc?._id ?? "")),
  },
  JSON: GraphQLJSON,
};