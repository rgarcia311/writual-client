import { gql } from "graphql-request";

export const PROJECTS_QUERY = gql`
query GetProjectData($input: ProjectFilters) {
  getProjectData(input: $input) {
    _id
    title
    logline
    genre
    type
    user
    displayName
    email
    poster
    sharedWith
    stats {
      totalScenes
      lockedScenes
      totalCharacters
      lockedCharacters
    }
    scenes {
      lockedVersion
    }
    characters {
      lockedVersion
    }
    activeVersion
    lockedVersion
    treatment {
      lockedVersion
      versions {
        version
      }
    }
    screenplay {
      lockedVersion
      versions {
        version
      }
    }
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
        stats {
            totalScenes
            lockedScenes
            totalCharacters
            lockedCharacters
        }
        activeVersion
        lockedVersion
        treatment {
            lockedVersion
            versions {
                version
            }
        }
        screenplay {
            lockedVersion
            versions {
                version
            }
        }
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