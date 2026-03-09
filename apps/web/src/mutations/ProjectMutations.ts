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
mutation UpdateProject(
    $_id: String!
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
    $timePeriod: String
) {
    updateProject(project: {
        _id: $_id
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
        timePeriod: $timePeriod
    }) {
        title
        _id
        user
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

export const LOCK_ALL_SCENES_IN_OUTLINE = gql`
  mutation LockAllScenesInOutline($projectId: String!) {
    lockAllScenesInOutline(projectId: $projectId) {
      lockedCount
    }
  }
`;

export const LOCK_ALL_CHARACTERS = gql`
  mutation LockAllCharacters($projectId: String!) {
    lockAllCharacters(projectId: $projectId) {
      lockedCount
    }
  }
`;

export const UNLOCK_OUTLINE_SECTION = gql`
  mutation UnlockOutlineSection($projectId: String!) {
    unlockOutlineSection(projectId: $projectId) {
      _id
      outlineSectionLocked
      stats {
        lockedScenes
        totalScenes
      }
    }
  }
`;

export const UNLOCK_CHARACTERS_SECTION = gql`
  mutation UnlockCharactersSection($projectId: String!) {
    unlockCharactersSection(projectId: $projectId) {
      _id
      charactersSectionLocked
      stats {
        lockedCharacters
        totalCharacters
      }
    }
  }
`;

