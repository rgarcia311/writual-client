import { gql } from "graphql-request";

export const CREATE_PROJECT = gql`
  mutation CreateProject(
    $title: String!
    $type: ProjectType
    $user: String!
    $displayName: String
    $email: String
    $logline: String
    $genre: String
    $poster: String
    $outlineName: String
    $sharedWith: [String]
    $budget: Int
    $similarProjects: [String]
  ) {
    createProject(
      input: {
        title: $title
        type: $type
        user: $user
        displayName: $displayName
        email: $email
        logline: $logline
        genre: $genre
        poster: $poster
        outlineName: $outlineName
        sharedWith: $sharedWith
        budget: $budget
        similarProjects: $similarProjects
      }
    ) {
      _id
      title
    }
  }
`;

export const DELETE_PROJECT = gql`
mutation DeleteProject($deleteProjectId: String!){
    deleteProject(id: $deleteProjectId)
}  
`;

export const UPDATE_PROJECT = gql`
mutation UpdateProject($title: String!, $logline: String!, $user: String!, $type: ProjectType!){
    updateProject(project:  { title: $title, logline: $logline, user: $user, type: $type }) {
        title,
        _id,
        user, 
        type
    }
}    
`;

export const UPDATE_PROJECT_SHARED_WITH = gql`
  mutation UpdateProjectSharedWith( $sharedWith: [String]) {
    updateProjectSharedWith(sharedWith: $sharedWith) {
      _id
      sharedWith
    }
  }
`;

/**
 * Server schema: createCharacter(character: CharacterInput): Character
 * CharacterInput: { projectId, name, details: [CharacterDetailsInput] }
 */
export const CREATE_CHARACTER = gql`
mutation CreateCharacter($character: CharacterInput!) {
  createCharacter(character: $character) {
    projectId
    name
    imageUrl
    details {
      version
      gender
      age
      bio
      need
      want
    }
  }
}
`;

