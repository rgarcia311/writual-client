"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = exports.ProjectType = void 0;
const graphql_scalars_1 = require("graphql-scalars");
const resolvers_1 = require("../resolvers");
const mutations_1 = require("../mutations");
exports.ProjectType = `#graphql

    scalar JSON

    type Query {
        getProjectData(input: ProjectFilters): [Project]
        getOutlineFrameworks(user: String!): [OutlineFramework]
    }

    type Mutation {
        setProjectOutline(input: OutlineInput): Outline
        createOutlineFramework(input: OutlineFrameworkInput!): OutlineFramework
        updateOutlineFramework(id: String!, input: OutlineFrameworkInput!): OutlineFramework
        createProject(input: ProjectInput): Project
        deleteProject(id: String): String
        shareProject(id: String, user: String): Project
        createScene(input: SceneInput): Scene
        updateProject(project: ProjectInput): Project
        updateProjectSharedWith(projectId: String!, sharedWith: [String]): Project
        createCharacter(character: CharacterInput): Character
        deleteScene(projectId: String!, sceneNumber: Int!): Project
    }

    type Project {
        _id: String!
        created_date: String
        modified_date: String
        revision: Int
        user: String!
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
        insporation: Insporation
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
        insporation: InsporationInput
        treatment: TreatmentInput
        screenplay: ScreenplayInput
        feedback: FeedbackInput
    }

    input ProjectFilters {
        filters: ProjectFilters
    }

    input ProjectInput {
        user: String!
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
        insporation: InsporationInput
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
        projectId: String
        number: Int
        activeVersion: Int
        lockedVersion: Int
        newVersion: Boolean
        newScene: Boolean
        versions: [SceneContent]
    }

    input SceneInput {
        _id: String
        number: Int
        activeVersion: Int
        lockedVersion: Int
        newVersion: Boolean
        newScene: Boolean
        versions: [SceneContentInput]
    }

    type Character {
        projectId: String
        name: String
        imageUrl: String
        details: [CharacterDetails]
    }

    type CharacterDetails {
        version: Int
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
        projectId: String
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

    type Insporation  {
        projectId: String
        scratch: String
        images: [String]
        videos: [String]
    }

    input InsporationInput  {
        scratch: String
        images: [String]
        videos: [String]
    }

    type Outline {
        projectId: String
        user: String
        format: OutlineFormat
    }

    type OutlineFramework {
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
exports.resolvers = {
    Query: {
        getProjectData: resolvers_1.getProjectData,
        getOutlineFrameworks: resolvers_1.getOutlineFrameworks,
    },
    Mutation: {
        setProjectOutline: mutations_1.setProjectOutline,
        createOutlineFramework: mutations_1.createOutlineFramework,
        updateOutlineFramework: mutations_1.updateOutlineFramework,
        createProject: mutations_1.createProject,
        deleteProject: mutations_1.deleteProject,
        shareProject: mutations_1.shareProject,
        updateProject: mutations_1.updateProject,
        updateProjectSharedWith: mutations_1.updateProjectSharedWith,
        createScene: mutations_1.createScene,
        createCharacter: mutations_1.createCharacter,
        deleteScene: mutations_1.deleteScene,
    },
    JSON: graphql_scalars_1.GraphQLJSON,
};
