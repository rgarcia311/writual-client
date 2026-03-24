import { GraphQLJSON } from "graphql-scalars";
import { getProjectData, getOutlineFrameworks } from "../resolvers";
import { setProjectOutline, createOutlineFramework, updateOutlineFramework, deleteOutlineFramework, createProject, deleteProject, shareProject, updateProject, updateProjectSharedWith, createinspiration, deleteinspiration, lockAllScenesInOutline, lockAllCharacters, unlockOutlineSection, unlockCharactersSection, saveScreenplay as saveScreenplayFn } from "../mutations";
import { AppUsers } from "../db-connector";
import { requireTier } from "../utils/tierUtils";
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
    updateProject,
    updateProjectSharedWith,
    createinspiration,
    deleteinspiration,
    saveScreenplay: async (root: unknown, args: { projectId: string; content: unknown }, context: { uid: string | null }) => {
      await requireTier(context, 'spec');
      return saveScreenplayFn(root, args);
    },
    lockAllScenesInOutline,
    lockAllCharacters,
    unlockOutlineSection,
    unlockCharactersSection,
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