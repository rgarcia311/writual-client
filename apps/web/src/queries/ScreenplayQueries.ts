import { gql } from 'graphql-request';

/**
 * Tab-bar metadata for every screenplay document on a project. Deliberately does not select
 * `versions.content` — a project can hold several feature-length scripts, and this query runs on
 * the characters and outline pages too, which only need the tab labels.
 */
export const SCREENPLAY_DOCUMENTS_QUERY = gql`
  query GetScreenplayDocuments($input: ProjectFilters) {
    getProjectData(input: $input) {
      _id
      screenplayDocuments {
        _id
        name
        isPrimary
        order
        sourceFileName
        pageCount
        versions {
          version
        }
      }
    }
  }
`;

/** One screenplay document including its script body — the read the editor makes. */
export const SCREENPLAY_DOCUMENT_QUERY = gql`
  query GetScreenplayDocument($projectId: ID!, $documentId: ID) {
    getScreenplayDocument(projectId: $projectId, documentId: $documentId) {
      _id
      name
      isPrimary
      layout
      pageCount
      versions {
        version
        content
      }
    }
  }
`;

/**
 * Existing character and scene cards, used by the import dialog's "replace specific" picker so the
 * writer can choose which cards an import overwrites and which survive it.
 */
export const PROJECT_IMPORT_ENTITIES_QUERY = gql`
  query GetProjectImportEntities($input: ProjectFilters) {
    getProjectData(input: $input) {
      _id
      characters {
        _id
        name
        screenplayDocumentId
        lockedVersion
      }
      scenes {
        _id
        screenplayDocumentId
        lockedVersion
        activeVersion
        versions {
          version
          sceneHeading
        }
      }
    }
  }
`;
