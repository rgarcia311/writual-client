import { gql } from 'graphql-request';

export const PROJECT_SCENES_QUERY = gql`
  query GetProjectScenes($input: ProjectFilters) {
    getProjectData(input: $input) {
      _id
      outlineName
      user
      sharedWith
      collaborators {
        uid
        permissionLevel
        status
      }
      outlineSectionLocked
      progressTrackingEnabled
      writingTracker {
        enabled
        targetPageCount
        currentPageCount
        trackingStartDate
        draftDueDates {
          draftNumber
          label
          dueDate
          tag
        }
      }
      stats {
        totalScenes
        lockedScenes
      }
      screenplay {
        versions {
          version
          content
        }
      }
      scenes {
        _id
        activeVersion
        lockedVersion
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
        }
      }
    }
  }
`;