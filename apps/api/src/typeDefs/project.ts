import { GraphQLJSON } from "graphql-scalars";
import { getProjectData, getOutlineFrameworks } from "../resolvers";
import { setProjectOutline, createOutlineFramework, updateOutlineFramework, deleteOutlineFramework, createProject, deleteProject, shareProject, updateProject, updateProjectSharedWith, createinspiration, deleteinspiration } from "../mutations";
export const ProjectType = `#graphql

    scalar JSON

    type Query {
        getProjectData(input: ProjectFilters): [Project]
        getOutlineFrameworks(user: String!): [OutlineFramework]
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
    }

    type  ScreenplayContent  {
        version: Int
        text: String
    }

    input ScreenplayInput {
        version: Int
        text: String
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
  },
  Project: {
    scenes: (parent: any, _: any, context: { scenesLoader: { load: (id: string) => Promise<any[]> } }) => {
      const id = parent?._id?.toString?.() ?? parent?._id;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'project.ts:Project.scenes',message:'Project.scenes resolver',data:{projectId:id},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
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