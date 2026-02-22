import { gql } from "graphql-request";

export const PROJECTS_QUERY = gql`
query GetProjectData($input: ProjectFilters) {
  getProjectData(input: $input) {
    _id
    title
    genre
    type
    logline
    user
    displayName
    email
    poster
    sharedWith
    
    outline {
      format {
        name
      }
    }
  }
}
`;

export const PROJECT_QUERY = gql`
query GetProjectData($input: ProjectFilters) {
    getProjectData(input: $input) {
        _id
        title
        genre
        type
        logline
        user
        displayName
        email
        poster
        sharedWith
        budget
        similarProjects
        timePeriod
        outlineName
        characters {
          details {
            age
            bio
            gender
            need
            version
            want
         }
         imageUrl
        name
        }
        scenes {
            _id
            activeVersion
            projectId
            versions {
                act
                antithesis
                step
                synopsis
                synthesis
                thesis
                version
                sceneHeading
                locked
            }
        }
        outline {
        format {
            name
        }
        }
        inspiration {
          _id
          projectId
          title
          image
          video
          note
          links
        }
    }
}
`;