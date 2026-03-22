import { gql } from 'graphql-request';

export const SAVE_SCREENPLAY = gql`
  mutation SaveScreenplay($projectId: ID!, $content: JSON!) {
    saveScreenplay(projectId: $projectId, content: $content) {
      projectId
      versions {
        version
        content
      }
    }
  }
`;
