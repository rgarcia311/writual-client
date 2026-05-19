import { gql } from 'graphql-request';

export const SAVE_SCREENPLAY = gql`
  mutation SaveScreenplay($projectId: ID!, $content: JSON!, $estimatedPageCount: Int) {
    saveScreenplay(projectId: $projectId, content: $content, estimatedPageCount: $estimatedPageCount) {
      projectId
      versions {
        version
        content
      }
    }
  }
`;
