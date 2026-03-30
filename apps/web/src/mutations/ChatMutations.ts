import { gql } from 'graphql-request';

export const SEND_MESSAGE = gql`
  mutation SendMessage($conversationId: ID!, $text: String!, $clientGeneratedId: String) {
    sendMessage(conversationId: $conversationId, text: $text, clientGeneratedId: $clientGeneratedId) {
      _id text senderId projectId clientGeneratedId createdAt
      sender { uid displayName name }
    }
  }
`;

export const MARK_AS_READ = gql`
  mutation MarkAsRead($conversationId: ID!) {
    markAsRead(conversationId: $conversationId)
  }
`;

export const CREATE_GROUP_CONVERSATION = gql`
  mutation CreateGroupConversation($projectId: ID!, $participantUids: [String!]!, $name: String!) {
    createGroupConversation(projectId: $projectId, participantUids: $participantUids, name: $name) {
      _id projectId type name unreadCount
      participants { uid displayName name }
      lastMessage { _id text senderId clientGeneratedId createdAt
        sender { uid displayName name }
      }
    }
  }
`;

export const LEAVE_CONVERSATION = gql`
  mutation LeaveConversation($conversationId: ID!) {
    leaveConversation(conversationId: $conversationId)
  }
`;
