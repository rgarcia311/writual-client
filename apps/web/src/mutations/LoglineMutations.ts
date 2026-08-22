import { gql } from "graphql-request";

/**
 * Every logline mutation returns the project's full history, newest first, so the card can repaint
 * from the mutation response while the background refetch settles.
 */
const LOGLINE_VERSION_FIELDS = `
  _id
  text
  authorUid
  authorName
  current
  createdAt
  feedback {
    _id
    authorUid
    authorName
    text
    createdAt
  }
`;

/** Writes the project's existing logline into the history as its first entry (idempotent). */
export const SEED_LOGLINE_HISTORY = gql`
mutation SeedLoglineHistory($projectId: ID!) {
  seedLoglineHistory(projectId: $projectId) { ${LOGLINE_VERSION_FIELDS} }
}
`;

export const ADD_LOGLINE_VERSION = gql`
mutation AddLoglineVersion($projectId: ID!, $text: String!) {
  addLoglineVersion(projectId: $projectId, text: $text) { ${LOGLINE_VERSION_FIELDS} }
}
`;

export const UPDATE_LOGLINE_VERSION = gql`
mutation UpdateLoglineVersion($projectId: ID!, $versionId: ID!, $text: String!) {
  updateLoglineVersion(projectId: $projectId, versionId: $versionId, text: $text) { ${LOGLINE_VERSION_FIELDS} }
}
`;

export const DELETE_LOGLINE_VERSION = gql`
mutation DeleteLoglineVersion($projectId: ID!, $versionId: ID!) {
  deleteLoglineVersion(projectId: $projectId, versionId: $versionId) { ${LOGLINE_VERSION_FIELDS} }
}
`;

export const SET_CURRENT_LOGLINE_VERSION = gql`
mutation SetCurrentLoglineVersion($projectId: ID!, $versionId: ID!) {
  setCurrentLoglineVersion(projectId: $projectId, versionId: $versionId) { ${LOGLINE_VERSION_FIELDS} }
}
`;

export const ADD_LOGLINE_FEEDBACK = gql`
mutation AddLoglineFeedback($projectId: ID!, $versionId: ID!, $text: String!) {
  addLoglineFeedback(projectId: $projectId, versionId: $versionId, text: $text) { ${LOGLINE_VERSION_FIELDS} }
}
`;

export const DELETE_LOGLINE_FEEDBACK = gql`
mutation DeleteLoglineFeedback($projectId: ID!, $versionId: ID!, $feedbackId: ID!) {
  deleteLoglineFeedback(projectId: $projectId, versionId: $versionId, feedbackId: $feedbackId) { ${LOGLINE_VERSION_FIELDS} }
}
`;
