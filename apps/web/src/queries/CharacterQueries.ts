import { gql } from "graphql-request";

export const PROJECT_CHARACTERS_QUERY = gql`
query GetProjectCharacters($input: ProjectFilters!) {
  getProjectData(input: $input) {
    _id
    progressTrackingEnabled
    writingTracker {
      enabled
    }
    charactersSectionLocked
    stats {
      totalCharacters
      lockedCharacters
    }
    characters {
      _id
      projectId
      name
      imageUrl
      activeVersion
      lockedVersion
      details {
        version
        name
        gender
        age
        bio
        need
        want
      }
    }
  }
}
`;

/** Fetched lazily when the Characters page Project Stats tab is active. */
export const PROJECT_TRACKING_STATS_QUERY = gql`
query GetProjectTrackingStats($input: ProjectFilters!) {
  getProjectData(input: $input) {
    _id
    progressTrackingEnabled
    title
    logline
    activeVersion
    lockedVersion
    writingTracker {
      enabled
      targetPageCount
      currentPageCount
      trackingStartDate
      draftDueDates { draftNumber label dueDate tag }
    }
    treatment {
      lockedVersion
      versions { version }
    }
    scenes {
      lockedVersion
    }
    screenplay {
      lockedVersion
      versions {
        version
        content
      }
    }
    characters {
      name
      imageUrl
    }
  }
}
`;

