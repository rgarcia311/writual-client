import { gql } from 'graphql-request';

/** Omitting `documentId` targets the project's primary screenplay document. */
export const SAVE_SCREENPLAY = gql`
  mutation SaveScreenplay($projectId: ID!, $documentId: ID, $content: JSON!, $estimatedPageCount: Int, $layout: JSON) {
    saveScreenplay(projectId: $projectId, documentId: $documentId, content: $content, estimatedPageCount: $estimatedPageCount, layout: $layout) {
      _id
      projectId
      name
      versions {
        version
        content
      }
      layout
    }
  }
`;

export const CREATE_SCREENPLAY_DOCUMENT = gql`
  mutation CreateScreenplayDocument($projectId: ID!, $name: String, $content: JSON, $layout: JSON, $pageCount: Int, $sourceFileName: String) {
    createScreenplayDocument(projectId: $projectId, name: $name, content: $content, layout: $layout, pageCount: $pageCount, sourceFileName: $sourceFileName) {
      _id
      name
      isPrimary
      order
      sourceFileName
      pageCount
    }
  }
`;

export const RENAME_SCREENPLAY_DOCUMENT = gql`
  mutation RenameScreenplayDocument($projectId: ID!, $documentId: ID!, $name: String!) {
    renameScreenplayDocument(projectId: $projectId, documentId: $documentId, name: $name) {
      _id
      name
    }
  }
`;

export const DELETE_SCREENPLAY_DOCUMENT = gql`
  mutation DeleteScreenplayDocument($projectId: ID!, $documentId: ID!) {
    deleteScreenplayDocument(projectId: $projectId, documentId: $documentId) {
      deleted
      reason
    }
  }
`;
