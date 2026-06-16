import { gql } from 'graphql-request';

export const SAVE_SCREENPLAY = gql`
  mutation SaveScreenplay($projectId: ID!, $content: JSON!, $estimatedPageCount: Int, $layout: JSON) {
    saveScreenplay(projectId: $projectId, content: $content, estimatedPageCount: $estimatedPageCount, layout: $layout) {
      projectId
      versions {
        version
        content
      }
      layout
    }
  }
`;
