import { GraphQLJSON } from "graphql-scalars";
import { getProjectData, getOutlineFrameworks } from "../resolvers";
import { setProjectOutline, createOutlineFramework, updateOutlineFramework, deleteOutlineFramework, createProject, deleteProject, shareProject, updateProject, updateProjectSharedWith, createinspiration, deleteinspiration, lockAllScenesInOutline, lockAllCharacters, unlockOutlineSection, unlockCharactersSection, saveScreenplay as saveScreenplayFn, persistWritingTrackerCurrentPageCount } from "../mutations";
import mongoose from "mongoose";
import { AppUsers, Projects, Scenes, Characters, Messages, Conversations, Notes } from "@writual/db";
import { requireTier } from "../utils/tierUtils";
import { resolveScreenplayPageCount } from "../utils/screenplayPageEstimate";
import { pusher } from "../services/pusher";
import { inviteCollaborators, updateCollaborator, removeCollaborator, claimInvite, finalizeSignup } from "../resolvers/collaboratorResolvers";
import { verifyProjectWriteAccess, verifyProjectCommentAccess } from "../lib/projectAccess";
import { GraphQLError } from "graphql";
import { createScene as createSceneService, updateScene as updateSceneService, deleteScene as deleteSceneService } from "../services/SceneService";
import { createCharacter as createCharacterService, updateCharacter as updateCharacterService, deleteCharacter as deleteCharacterService } from "../services/CharacterService";
import { createNote as createNoteService, updateNote as updateNoteService, deleteNote as deleteNoteService } from "../services/NoteService";
import { seedLoglineHistory, addLoglineVersion, updateLoglineVersion, deleteLoglineVersion, setCurrentLoglineVersion, addLoglineFeedback, deleteLoglineFeedback } from "../services/LoglineService";
import { createScreenplayDocument as createScreenplayDocumentService, renameScreenplayDocument as renameScreenplayDocumentService, deleteScreenplayDocument as deleteScreenplayDocumentService, getScreenplayDocumentWithContent, pickPrimary, type ScreenplayDocumentRow } from "../services/ScreenplayDocumentService";
export const ProjectType = `#graphql

    scalar JSON

    type UserSettings {
        colorMode: String!
        """Visible stat tiles keyed by project page, e.g. characters: [characters, deadlines]."""
        statTilePreferences: JSON
        """True once the intro walkthrough was completed or dismissed; suppresses it on login."""
        walkthroughDismissed: Boolean!
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
        """
        One screenplay document including its script body. Project.screenplayDocuments returns
        metadata only, so the editor reads the document it is displaying through this.
        Omit documentId to get the project's primary document.
        """
        getScreenplayDocument(projectId: ID!, documentId: ID): ScreenplayDocument
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
        """Writes content into one screenplay document; omit documentId to target the primary."""
        saveScreenplay(projectId: ID!, documentId: ID, content: JSON!, estimatedPageCount: Int, layout: JSON): ScreenplayDocument
        createScreenplayDocument(projectId: ID!, name: String, content: JSON, layout: JSON, pageCount: Int, sourceFileName: String): ScreenplayDocument
        renameScreenplayDocument(projectId: ID!, documentId: ID!, name: String!): ScreenplayDocument
        deleteScreenplayDocument(projectId: ID!, documentId: ID!): DeleteScreenplayDocumentResult
        syncWritingTrackerCurrentPages(projectId: ID!, currentPageCount: Int!): Project
        lockAllScenesInOutline(projectId: String!): LockAllScenesResult
        lockAllCharacters(projectId: String!): LockAllCharactersResult
        unlockOutlineSection(projectId: String!): Project
        unlockCharactersSection(projectId: String!): Project
        sendMessage(conversationId: ID!, text: String!, clientGeneratedId: String): Message
        markAsRead(conversationId: ID!): Boolean
        setStatTilePreference(page: String!, statKeys: [String!]!): JSON
        clearStatTilePreference(page: String!): JSON
        setWalkthroughDismissed(dismissed: Boolean!): Boolean!
        createGroupConversation(projectId: ID!, participantUids: [String!]!, name: String!): ConversationThread
        leaveConversation(conversationId: ID!): Boolean
        createScene(projectId: String!, input: CreateSceneInput!): Scene
        updateScene(sceneId: String!, input: UpdateSceneInput!): Scene
        deleteScene(sceneId: String!): DeleteResult
        createCharacter(projectId: String!, input: CreateCharacterInput!): Character
        updateCharacter(characterId: String!, input: UpdateCharacterInput!): Character
        deleteCharacter(characterId: String!): DeleteResult
        createNote(projectId: String!, input: CreateNoteInput!): Note
        updateNote(noteId: String!, input: UpdateNoteInput!): Note
        deleteNote(noteId: String!): DeleteResult
        seedLoglineHistory(projectId: ID!): [LoglineVersion!]!
        addLoglineVersion(projectId: ID!, text: String!): [LoglineVersion!]!
        updateLoglineVersion(projectId: ID!, versionId: ID!, text: String!): [LoglineVersion!]!
        deleteLoglineVersion(projectId: ID!, versionId: ID!): [LoglineVersion!]!
        setCurrentLoglineVersion(projectId: ID!, versionId: ID!): [LoglineVersion!]!
        addLoglineFeedback(projectId: ID!, versionId: ID!, text: String!): [LoglineVersion!]!
        deleteLoglineFeedback(projectId: ID!, versionId: ID!, feedbackId: ID!): [LoglineVersion!]!
        inviteCollaborators(projectId: ID!, invitations: [InvitationInput!]!): Project
        updateCollaborator(projectId: ID!, collaboratorId: ID!, permissionLevel: String, aspects: [String!]): Project
        removeCollaborator(projectId: ID!, collaboratorId: ID!): Project
        claimInvite(token: String!): Project
        finalizeSignup: Boolean
    }

    type DraftDueDate {
        draftNumber: Int!
        label: String!
        dueDate: String!
        tag: String
    }

    input DraftDueDateInput {
        draftNumber: Int!
        label: String!
        dueDate: String!
        tag: String
    }

    type WritingTracker {
        enabled: Boolean!
        targetPageCount: Int
        currentPageCount: Int
        trackingStartDate: String
        draftDueDates: [DraftDueDate!]!
    }

    input WritingTrackerInput {
        enabled: Boolean!
        targetPageCount: Int
        currentPageCount: Int
        trackingStartDate: String
        draftDueDates: [DraftDueDateInput!]!
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
        """Logline iteration history, newest first; the current entry mirrors the logline field."""
        loglineHistory: [LoglineVersion!]!
        budget: Int
        poster: String
        similarProjects: [String]
        outlineName: String
        scenes: [Scene]
        characters: [Character]
        notes: [Note]
        outline: Outline
        inspiration: [inspiration]
        """The primary screenplay document, in the legacy shape. Prefer screenplayDocuments."""
        screenplay: Screenplay
        """Every screenplay document on the project, in tab order."""
        screenplayDocuments: [ScreenplayDocument]
        feedback: Feedback
        stats: ProjectStats
        pageCountEstimate: Int
        outlineSectionLocked: Boolean
        charactersSectionLocked: Boolean
        activeVersion: Int
        lockedVersion: Int
        writingTracker: WritingTracker
        progressTrackingEnabled: Boolean
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
        screenplay: ScreenplayInput
        feedback: FeedbackInput
        stats: ProjectStatsInput
        pageCountEstimate: Int
        outlineSectionLocked: Boolean
        charactersSectionLocked: Boolean
        activeVersion: Int
        lockedVersion: Int
        writingTracker: WritingTrackerInput
        progressTrackingEnabled: Boolean
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
        """Screenplay document this scene came from; null means the project's primary document."""
        screenplayDocumentId: String
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

    input CreateSceneInput {
        """Screenplay document to attach the scene to; omit for the project's primary document."""
        screenplayDocumentId: String
        activeVersion: Int
        lockedVersion: Int
        newVersion: Boolean
        newScene: Boolean
        versions: [SceneContentInput]
    }

    input UpdateSceneInput {
        activeVersion: Int
        lockedVersion: Int
        newVersion: Boolean
        versions: [SceneContentInput]
    }

    type Character {
        _id: String
        projectId: String
        """Screenplay document this character came from; null means the primary document."""
        screenplayDocumentId: String
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

    input CreateCharacterInput {
        """Screenplay document to attach the character to; omit for the primary document."""
        screenplayDocumentId: String
        imageUrl: String
        activeVersion: Int
        lockedVersion: Int
        details: [CharacterDetailInput]
    }

    input UpdateCharacterInput {
        imageUrl: String
        newVersion: Boolean
        activeVersion: Int
        lockedVersion: Int
        details: [CharacterDetailInput]
    }

    input CharacterDetailInput {
        version: Int
        bio: String
        name: String
        age: Int
        gender: String
        need: String
        want: String
    }

    """A research/idea note attached to a project, optionally linked to a character, scene or inspiration item."""
    type Note {
        _id: String
        projectId: String
        title: String
        category: String
        """Rich text body, stored as HTML."""
        content: String
        """True once the note has made it into the story."""
        incorporated: Boolean
        """False parks the note in the "Maybe" bucket: kept, but not committed to the story."""
        shouldIncorporate: Boolean
        association: NoteAssociation
        createdAt: String
        updatedAt: String
    }

    type NoteAssociation {
        kind: NoteAssociationKind
        targetId: String
        label: String
    }

    enum NoteAssociationKind {
        none
        character
        scene
        inspiration
    }

    input NoteAssociationInput {
        kind: NoteAssociationKind
        targetId: String
        label: String
    }

    input CreateNoteInput {
        title: String
        category: String
        content: String
        incorporated: Boolean
        shouldIncorporate: Boolean
        association: NoteAssociationInput
    }

    input UpdateNoteInput {
        title: String
        category: String
        content: String
        incorporated: Boolean
        shouldIncorporate: Boolean
        association: NoteAssociationInput
    }

    """Feedback left on one logline version by the project owner or a shared collaborator."""
    type LoglineFeedback {
        _id: String!
        authorUid: String!
        """Display name captured when the feedback was written."""
        authorName: String
        text: String!
        createdAt: String
        updatedAt: String
    }

    """One iteration of the project logline. The entry flagged current mirrors Project.logline."""
    type LoglineVersion {
        _id: String!
        text: String!
        authorUid: String
        authorName: String
        current: Boolean!
        feedback: [LoglineFeedback!]!
        createdAt: String
        updatedAt: String
    }

    type DeleteResult {
        deleted: Boolean!
        projectId: String
    }

    enum ProjectType {
        Film
        Feature 
        Television
        Short 
    }

    type Screenplay {
        projectId: String
        versions: [ScreenplayContent]
        lockedVersion: Int
        layout: JSON
        """Body page total (title page excluded). Estimated from content when not yet recorded."""
        pageCount: Int
    }

    type  ScreenplayContent  {
        version: Int
        content: JSON
    }

    """
    One screenplay document belonging to a project. A project may hold several — the original draft
    plus PDFs imported later — each with its own collaboration state, characters and scenes.
    Project.screenplay resolves to whichever document has isPrimary true.
    """
    type ScreenplayDocument {
        _id: String!
        projectId: String
        """Tab label on the screenplay page."""
        name: String
        """The document Project.screenplay resolves to. Exactly one per project."""
        isPrimary: Boolean
        """Tab order; ties break by creation time."""
        order: Int
        """Original file name when this document came from a PDF import."""
        sourceFileName: String
        versions: [ScreenplayContent]
        lockedVersion: Int
        layout: JSON
        """Body page total (title page excluded). Estimated from content when not yet recorded."""
        pageCount: Int
    }

    type DeleteScreenplayDocumentResult {
        deleted: Boolean!
        reason: String
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

/** Project pages that render a stat-tile rail; also the allowed keys of `settings.statTilePreferences`. */
const STAT_TILE_PAGES = ['overview', 'characters', 'notes', 'outline', 'chat'];
/**
 * Cards a page may show — mirrors `ALL_PROJECT_STAT_TILE_KEYS` on the web client, in the same
 * canonical order: the two hero cards first, then the stat tiles.
 */
const STAT_TILE_KEYS = [
  'poster',
  'details',
  'logline',
  'progress',
  'characters',
  'scenes',
  'deadlines',
];

/** `settings.statTilePreferences` is a Mongoose Map on documents and a plain object on lean reads. */
function statTilePreferencesToObject(value: unknown): Record<string, string[]> {
  if (value instanceof Map) return Object.fromEntries(value) as Record<string, string[]>;
  return (value as Record<string, string[]>) ?? {};
}

/** Name to attribute a logline entry or its feedback to, from the resolver context. */
function actorDisplayName(context: { user?: { displayName?: string | null; name?: string | null } | null }): string {
  return context?.user?.displayName ?? context?.user?.name ?? '';
}

export const resolvers = {
  UserSettings: {
    statTilePreferences: (parent: { statTilePreferences?: unknown }) =>
      statTilePreferencesToObject(parent?.statTilePreferences),
    // Accounts created before the walkthrough shipped have no such field, and those users have
    // never seen it — so `undefined` reads as "not dismissed" rather than breaking the non-null.
    walkthroughDismissed: (parent: { walkthroughDismissed?: boolean | null }) =>
      parent?.walkthroughDismissed ?? false,
  },
  Query: {
    getProjectData,
    getScreenplayDocument: async (
      _root: unknown,
      args: { projectId: string; documentId?: string | null },
      context: { uid: string | null }
    ) => {
      if (!context.uid) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      // Read access follows the same membership rule as every other project read.
      const project = await Projects.findOne({
        _id: new mongoose.Types.ObjectId(args.projectId),
        $or: [
          { user: context.uid },
          { sharedWith: context.uid },
          { collaborators: { $elemMatch: { uid: context.uid, status: 'active' } } },
        ],
      }).select('_id').lean().exec();
      if (!project) {
        throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
      }
      return getScreenplayDocumentWithContent(args.projectId, args.documentId ?? null);
    },
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
            sharedWith: 1, collaborators: 1, stats: 1, user: 1, createdAt: 1,
          },
        },
        {
          // Screenplay content lives in its own collection; `screenplayStarted` below only needs to
          // know whether any document has content, so pull back a single lightweight marker rather
          // than whole TipTap documents.
          $lookup: {
            from: 'screenplays',
            let: { pid: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$projectId', '$$pid'] } } },
              { $match: { 'versions.0': { $exists: true } } },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: 'screenplayDocs',
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
          screenplayStarted: (project.screenplayDocs?.length ?? 0) > 0,
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
    saveScreenplay: async (
      root: unknown,
      args: { projectId: string; documentId?: string | null; content: unknown; estimatedPageCount?: number | null; layout?: unknown },
      context: { uid: string | null }
    ) => {
      await requireTier(context, 'spec');
      await verifyProjectWriteAccess(args.projectId, context.uid!);
      return saveScreenplayFn(root, args);
    },
    createScreenplayDocument: async (
      _root: unknown,
      args: {
        projectId: string;
        name?: string | null;
        content?: unknown;
        layout?: unknown;
        pageCount?: number | null;
        sourceFileName?: string | null;
      },
      context: { uid: string | null }
    ) => {
      await requireTier(context, 'spec');
      await verifyProjectWriteAccess(args.projectId, context.uid!);
      const { projectId, ...payload } = args;
      return createScreenplayDocumentService(projectId, payload);
    },
    renameScreenplayDocument: async (
      _root: unknown,
      args: { projectId: string; documentId: string; name: string },
      context: { uid: string | null }
    ) => {
      await requireTier(context, 'spec');
      await verifyProjectWriteAccess(args.projectId, context.uid!);
      return renameScreenplayDocumentService(args.projectId, args.documentId, args.name);
    },
    deleteScreenplayDocument: async (
      _root: unknown,
      args: { projectId: string; documentId: string },
      context: { uid: string | null }
    ) => {
      await requireTier(context, 'spec');
      await verifyProjectWriteAccess(args.projectId, context.uid!);
      return deleteScreenplayDocumentService(args.projectId, args.documentId);
    },
    syncWritingTrackerCurrentPages: async (
      _root: unknown,
      args: { projectId: string; currentPageCount: number },
      context: { uid: string | null }
    ) => {
      if (!context.uid) {
        throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      await requireTier(context, 'spec');
      await verifyProjectWriteAccess(args.projectId, context.uid);
      const { projectId, currentPageCount } = args;
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new GraphQLError('Invalid projectId', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const rounded = Math.round(Number(currentPageCount));
      if (!Number.isFinite(rounded)) {
        throw new GraphQLError('Invalid currentPageCount', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const clamped = Math.min(99999, Math.max(1, rounded));
      const doc = await persistWritingTrackerCurrentPageCount(projectId, clamped);
      if (!doc) {
        throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
      }
      return doc;
    },
    lockAllScenesInOutline,
    lockAllCharacters,
    unlockOutlineSection,
    unlockCharactersSection,
    createScene: async (_root: unknown, args: { projectId: string; input: any }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await requireTier(context, 'indie');
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return createSceneService(args.projectId, args.input);
    },
    updateScene: async (_root: unknown, args: { sceneId: string; input: any }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      const scene = await Scenes.findById(args.sceneId).lean().exec();
      if (!scene) throw new GraphQLError('Scene not found', { extensions: { code: 'NOT_FOUND' } });
      await verifyProjectWriteAccess((scene as any).projectId.toString(), context.uid);
      return updateSceneService(args.sceneId, args.input);
    },
    deleteScene: async (_root: unknown, args: { sceneId: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      const scene = await Scenes.findById(args.sceneId).lean().exec();
      if (!scene) throw new GraphQLError('Scene not found', { extensions: { code: 'NOT_FOUND' } });
      await verifyProjectWriteAccess((scene as any).projectId.toString(), context.uid);
      const result = await deleteSceneService(args.sceneId);
      return { deleted: result.deleted, projectId: result.projectId ?? null };
    },
    createCharacter: async (_root: unknown, args: { projectId: string; input: any }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await requireTier(context, 'indie');
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return createCharacterService(args.projectId, args.input);
    },
    updateCharacter: async (_root: unknown, args: { characterId: string; input: any }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      const character = await Characters.findById(args.characterId).lean().exec();
      if (!character) throw new GraphQLError('Character not found', { extensions: { code: 'NOT_FOUND' } });
      await verifyProjectWriteAccess((character as any).projectId.toString(), context.uid);
      return updateCharacterService(args.characterId, args.input);
    },
    deleteCharacter: async (_root: unknown, args: { characterId: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      const character = await Characters.findById(args.characterId).lean().exec();
      if (!character) throw new GraphQLError('Character not found', { extensions: { code: 'NOT_FOUND' } });
      await verifyProjectWriteAccess((character as any).projectId.toString(), context.uid);
      const result = await deleteCharacterService(args.characterId);
      return { deleted: result.deleted, projectId: result.projectId ?? null };
    },
    createNote: async (_root: unknown, args: { projectId: string; input: any }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await requireTier(context, 'indie');
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return createNoteService(args.projectId, args.input);
    },
    updateNote: async (_root: unknown, args: { noteId: string; input: any }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      const note = await Notes.findById(args.noteId).lean().exec();
      if (!note) throw new GraphQLError('Note not found', { extensions: { code: 'NOT_FOUND' } });
      await verifyProjectWriteAccess((note as any).projectId.toString(), context.uid);
      return updateNoteService(args.noteId, args.input);
    },
    deleteNote: async (_root: unknown, args: { noteId: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      const note = await Notes.findById(args.noteId).lean().exec();
      if (!note) throw new GraphQLError('Note not found', { extensions: { code: 'NOT_FOUND' } });
      await verifyProjectWriteAccess((note as any).projectId.toString(), context.uid);
      const result = await deleteNoteService(args.noteId);
      return { deleted: result.deleted, projectId: result.projectId ?? null };
    },
    seedLoglineHistory: async (_root: unknown, args: { projectId: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return seedLoglineHistory(args.projectId);
    },
    addLoglineVersion: async (_root: unknown, args: { projectId: string; text: string }, context: { uid: string | null; user: any }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return addLoglineVersion(args.projectId, args.text, { uid: context.uid, displayName: actorDisplayName(context) });
    },
    updateLoglineVersion: async (_root: unknown, args: { projectId: string; versionId: string; text: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return updateLoglineVersion(args.projectId, args.versionId, args.text);
    },
    deleteLoglineVersion: async (_root: unknown, args: { projectId: string; versionId: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return deleteLoglineVersion(args.projectId, args.versionId);
    },
    setCurrentLoglineVersion: async (_root: unknown, args: { projectId: string; versionId: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await verifyProjectWriteAccess(args.projectId, context.uid);
      return setCurrentLoglineVersion(args.projectId, args.versionId);
    },
    // Feedback is open to comment-level collaborators, not just editors.
    addLoglineFeedback: async (_root: unknown, args: { projectId: string; versionId: string; text: string }, context: { uid: string | null; user: any }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      await verifyProjectCommentAccess(args.projectId, context.uid);
      return addLoglineFeedback(args.projectId, args.versionId, args.text, { uid: context.uid, displayName: actorDisplayName(context) });
    },
    deleteLoglineFeedback: async (_root: unknown, args: { projectId: string; versionId: string; feedbackId: string }, context: { uid: string | null }) => {
      if (!context.uid) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
      const { isOwner } = await verifyProjectCommentAccess(args.projectId, context.uid);
      return deleteLoglineFeedback(args.projectId, args.versionId, args.feedbackId, context.uid, isOwner);
    },
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
    setStatTilePreference: async (
      _: unknown,
      { page, statKeys }: { page: string; statKeys: string[] },
      context: { uid: string | null }
    ) => {
      if (!context.uid) throw new Error('Unauthorized');
      if (!STAT_TILE_PAGES.includes(page)) throw new Error(`Unknown stat tile page: ${page}`);
      // Whitelisted so an unknown key can never be written into the settings path.
      const invalid = statKeys.filter((key) => !STAT_TILE_KEYS.includes(key));
      if (invalid.length > 0) throw new Error(`Unknown stat tile key(s): ${invalid.join(', ')}`);
      // De-duplicate and store in the canonical tile order so read order never depends on click order.
      const cleaned = STAT_TILE_KEYS.filter((key) => statKeys.includes(key));

      const updated = await AppUsers.findOneAndUpdate(
        { uid: context.uid },
        { $set: { [`settings.statTilePreferences.${page}`]: cleaned } },
        { new: true, upsert: true }
      ).lean().exec();

      return statTilePreferencesToObject((updated as any)?.settings?.statTilePreferences);
    },
    /** Drops a page's saved choice so it follows the page's built-in tiles again. */
    clearStatTilePreference: async (
      _: unknown,
      { page }: { page: string },
      context: { uid: string | null }
    ) => {
      if (!context.uid) throw new Error('Unauthorized');
      if (!STAT_TILE_PAGES.includes(page)) throw new Error(`Unknown stat tile page: ${page}`);

      const updated = await AppUsers.findOneAndUpdate(
        { uid: context.uid },
        { $unset: { [`settings.statTilePreferences.${page}`]: '' } },
        { new: true }
      ).lean().exec();

      return statTilePreferencesToObject((updated as any)?.settings?.statTilePreferences);
    },
    /**
     * Records whether the intro walkthrough should still greet this user on login. Written when
     * they tick "Don't show this again", when they reach the last step, and (with `false`) when
     * they replay the tour from Settings.
     */
    setWalkthroughDismissed: async (
      _: unknown,
      { dismissed }: { dismissed: boolean },
      context: { uid: string | null }
    ) => {
      if (!context.uid) throw new Error('Unauthorized');

      await AppUsers.updateOne(
        { uid: context.uid },
        { $set: { 'settings.walkthroughDismissed': dismissed } },
        { upsert: true }
      ).exec();

      return dismissed;
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
  Screenplay: {
    // Falls back to an analytic estimate so screenplays saved before `pageCount` existed still
    // report a page total (e.g. to prefill the enable-tracking modal).
    pageCount: (parent: any) => resolveScreenplayPageCount(parent),
  },
  ScreenplayContent: {
    /**
     * Fetched on demand. The screenplay batch loader returns metadata without script bodies, so a
     * dashboard listing many projects does not pull a feature script for each one; queries that
     * actually select `content` pay for it here, batched by document.
     */
    content: async (
      parent: any,
      _: any,
      context: { screenplayContentLoader: { load: (id: string) => Promise<Map<number, unknown>> } }
    ) => {
      if (parent?.content !== undefined) return parent.content ?? null;
      if (parent?.documentId == null) return null;
      const versions = await context.screenplayContentLoader.load(String(parent.documentId));
      return versions.get(Number(parent.version ?? 0)) ?? null;
    },
  },
  ScreenplayDocument: {
    _id: (parent: any) => String(parent._id),
    projectId: (parent: any) => (parent?.projectId != null ? String(parent.projectId) : null),
    pageCount: (parent: any) => resolveScreenplayPageCount(parent),
  },
  Project: {
    // Screenplay content lives in its own collection now, so both fields load through one
    // per-request batch rather than being read off the project document.
    screenplayDocuments: (
      parent: any,
      _: any,
      context: { screenplayDocumentsLoader: { load: (id: string) => Promise<ScreenplayDocumentRow[]> } }
    ) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      return id ? context.screenplayDocumentsLoader.load(id) : [];
    },
    /**
     * Back-compat: resolves to the primary document so callers written against the single-screenplay
     * shape (dashboard cards, chat's developmentStatus, the enable-tracking modal) keep working.
     */
    screenplay: async (
      parent: any,
      _: any,
      context: { screenplayDocumentsLoader: { load: (id: string) => Promise<ScreenplayDocumentRow[]> } }
    ) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      if (!id) return null;
      return pickPrimary(await context.screenplayDocumentsLoader.load(id));
    },
    scenes: (parent: any, _: any, context: { scenesLoader: { load: (id: string) => Promise<any[]> } }) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      return id ? context.scenesLoader.load(id) : [];
    },
    characters: (parent: any, _: any, context: { charactersLoader: { load: (id: string) => Promise<any[]> } }) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      return id ? context.charactersLoader.load(id) : [];
    },
    notes: (parent: any, _: any, context: { notesLoader: { load: (id: string) => Promise<any[]> } }) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      return id ? context.notesLoader.load(id) : [];
    },
    loglineHistory: (parent: any) => (Array.isArray(parent?.loglineHistory) ? parent.loglineHistory : []),
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
    // Null means the scene belongs to the project's primary screenplay document — the shape every
    // scene created before multi-document support has.
    screenplayDocumentId: (parent: any) =>
      parent?.screenplayDocumentId != null ? String(parent.screenplayDocumentId) : null,
  },
  Character: {
    _id: (parent: any) => (parent?._id != null ? String(parent._id) : null),
    projectId: (parent: any) => (parent?.projectId != null ? String(parent.projectId) : null),
    // Null means the character belongs to the project's primary screenplay document.
    screenplayDocumentId: (parent: any) =>
      parent?.screenplayDocumentId != null ? String(parent.screenplayDocumentId) : null,
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
  LoglineVersion: {
    _id: (parent: any) => (parent?._id != null ? String(parent._id) : ''),
    text: (parent: any) => parent?.text ?? '',
    authorUid: (parent: any) => parent?.authorUid ?? null,
    authorName: (parent: any) => parent?.authorName ?? null,
    current: (parent: any) => Boolean(parent?.current),
    feedback: (parent: any) => (Array.isArray(parent?.feedback) ? parent.feedback : []),
    createdAt: (parent: any) => (parent?.createdAt != null ? new Date(parent.createdAt).toISOString() : null),
    updatedAt: (parent: any) => (parent?.updatedAt != null ? new Date(parent.updatedAt).toISOString() : null),
  },
  LoglineFeedback: {
    _id: (parent: any) => (parent?._id != null ? String(parent._id) : ''),
    authorUid: (parent: any) => parent?.authorUid ?? '',
    authorName: (parent: any) => parent?.authorName ?? null,
    text: (parent: any) => parent?.text ?? '',
    createdAt: (parent: any) => (parent?.createdAt != null ? new Date(parent.createdAt).toISOString() : null),
    updatedAt: (parent: any) => (parent?.updatedAt != null ? new Date(parent.updatedAt).toISOString() : null),
  },
  Note: {
    _id: (parent: any) => (parent?._id != null ? String(parent._id) : null),
    projectId: (parent: any) => (parent?.projectId != null ? String(parent.projectId) : null),
    title: (parent: any) => parent?.title ?? '',
    category: (parent: any) => parent?.category ?? '',
    content: (parent: any) => parent?.content ?? '',
    incorporated: (parent: any) => Boolean(parent?.incorporated),
    shouldIncorporate: (parent: any) => parent?.shouldIncorporate !== false,
    association: (parent: any) => ({
      kind: parent?.association?.kind ?? 'none',
      targetId: parent?.association?.targetId != null ? String(parent.association.targetId) : null,
      label: parent?.association?.label ?? null,
    }),
    createdAt: (parent: any) => (parent?.createdAt != null ? new Date(parent.createdAt).toISOString() : null),
    updatedAt: (parent: any) => (parent?.updatedAt != null ? new Date(parent.updatedAt).toISOString() : null),
  },
  OutlineFramework: {
    _id: (doc: any) => (doc?._id != null ? String(doc._id) : String(doc?.id ?? "")),
    id: (doc: any) => (doc?.id != null && String(doc.id).length ? String(doc.id) : String(doc?._id ?? "")),
  },
  JSON: GraphQLJSON,
};