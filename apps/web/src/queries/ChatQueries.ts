import { gql } from 'graphql-request';

export const GET_PROJECT_CONVERSATIONS = gql`
  query GetProjectConversations($projectId: ID!) {
    getProjectConversations(projectId: $projectId) {
      _id projectId type name unreadCount
      participants { uid displayName name }
      lastMessage { _id text senderId clientGeneratedId createdAt
        sender { uid displayName name }
      }
    }
  }
`;

export const GET_PROJECT_CHATS = gql`
  query GetProjectChats {
    getProjectChats {
      _id title displayName ownerDisplayName user genre type poster sharedWith createdAt unreadCount
      collaborators { _id email uid status permissionLevel aspects invitedAt }
      developmentStatus {
        outlineStarted charactersStarted treatmentStarted screenplayStarted
      }
      lastMessage { _id text senderId clientGeneratedId createdAt
        sender { uid displayName name }
      }
    }
  }
`;

export const GET_PROJECT_MESSAGES = gql`
  query GetProjectMessages($conversationId: ID!, $limit: Int, $offset: Int) {
    getProjectMessages(conversationId: $conversationId, limit: $limit, offset: $offset) {
      _id text senderId projectId clientGeneratedId createdAt
      sender { uid displayName name }
    }
  }
`;
