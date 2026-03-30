import { gql } from 'graphql-request';

const COLLABORATOR_FIELDS = gql`
  fragment CollaboratorFields on Collaborator {
    _id
    email
    uid
    status
    permissionLevel
    aspects
    invitedAt
  }
`;

export const INVITE_COLLABORATORS = gql`
  ${COLLABORATOR_FIELDS}
  mutation InviteCollaborators($projectId: ID!, $invitations: [InvitationInput!]!) {
    inviteCollaborators(projectId: $projectId, invitations: $invitations) {
      _id
      collaborators {
        ...CollaboratorFields
      }
    }
  }
`;

export const UPDATE_COLLABORATOR = gql`
  ${COLLABORATOR_FIELDS}
  mutation UpdateCollaborator($projectId: ID!, $collaboratorId: ID!, $permissionLevel: String, $aspects: [String!]) {
    updateCollaborator(projectId: $projectId, collaboratorId: $collaboratorId, permissionLevel: $permissionLevel, aspects: $aspects) {
      _id
      collaborators {
        ...CollaboratorFields
      }
    }
  }
`;

export const REMOVE_COLLABORATOR = gql`
  ${COLLABORATOR_FIELDS}
  mutation RemoveCollaborator($projectId: ID!, $collaboratorId: ID!) {
    removeCollaborator(projectId: $projectId, collaboratorId: $collaboratorId) {
      _id
      collaborators {
        ...CollaboratorFields
      }
    }
  }
`;

export const CLAIM_INVITE = gql`
  mutation ClaimInvite($token: String!) {
    claimInvite(token: $token) {
      _id
    }
  }
`;

export const FINALIZE_SIGNUP = gql`
  mutation FinalizeSignup {
    finalizeSignup
  }
`;
