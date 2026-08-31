import { gql } from "graphql-request";

export const PROJECTS_QUERY = gql`
query GetProjectData($input: ProjectFilters) {
  getProjectData(input: $input) {
    _id
    title
    logline
    genre
    type
    timePeriod
    user
    displayName
    email
    poster
    sharedWith
    budget
    similarProjects
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
    screenplay {
      lockedVersion
      pageCount
      versions {
        version
      }
    }
    outline {
      format {
        name
      }
    }
    writingTracker {
      enabled
      targetPageCount
      currentPageCount
      trackingStartDate
      draftDueDates { draftNumber label dueDate tag }
    }
    progressTrackingEnabled
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
        loglineHistory {
            _id
            text
            authorUid
            authorName
            current
            createdAt
            feedback { _id authorUid authorName text createdAt }
        }
        collaborators { _id uid email status permissionLevel aspects screenplayDocumentIds }
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
        outlineSectionLocked
        charactersSectionLocked
        activeVersion
        lockedVersion
        screenplay {
            lockedVersion
            versions {
                version
                content
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
        writingTracker {
          enabled
          targetPageCount
          currentPageCount
          trackingStartDate
          draftDueDates { draftNumber label dueDate tag }
        }
        progressTrackingEnabled
    }
}
`;

/**
 * Who a project is shared with, and what each of them was granted — owner uid, collaborator rows
 * and the screenplay documents a grant can name. Deliberately tiny: the chat reads this on every
 * project it opens, and the fuller PROJECT_QUERY carries scenes, characters and script bodies.
 */
export const PROJECT_ACCESS_QUERY = gql`
query GetProjectAccess($input: ProjectFilters) {
    getProjectData(input: $input) {
        _id
        title
        user
        displayName
        sharedWith
        collaborators { _id uid email status permissionLevel aspects screenplayDocumentIds invitedAt }
        screenplayDocuments { _id name isPrimary order }
    }
}
`;
