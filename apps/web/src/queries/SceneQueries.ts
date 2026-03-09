import { gql } from 'graphql-request';

export const PROJECT_SCENES_QUERY = gql`
  query GetProjectScenes($input: ProjectFilters) {
    getProjectData(input: $input) {
      _id
      outlineName
      user
      outlineSectionLocked
      stats {
        totalScenes
        lockedScenes
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