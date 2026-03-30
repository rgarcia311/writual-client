import type { Collaborator } from './collaborator';

export interface ChatSender {
  uid: string;
  name: string | null;
  displayName: string | null;
}

export interface ChatMessage {
  _id: string;
  text: string;
  senderId: string;
  projectId: string;
  createdAt: string | null;
  clientGeneratedId: string | null;
  sender: ChatSender | null;
  // Client-side only fields (not in GraphQL)
  isError?: boolean;
}

export interface DevelopmentStatus {
  outlineStarted: boolean;
  charactersStarted: boolean;
  treatmentStarted: boolean;
  screenplayStarted: boolean;
}

export interface ConversationParticipant {
  uid: string;
  displayName: string | null;
  name: string | null;
}

export interface ConversationThread {
  _id: string;
  projectId: string;
  type: 'direct' | 'group';
  name: string | null;
  participants: ConversationParticipant[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export interface ChatThread {
  _id: string;
  title: string;
  displayName: string | null;
  ownerDisplayName: string | null;
  user: string | null;          // Firebase UID of project owner
  genre: string | null;
  type: string | null;
  poster: string | null;
  sharedWith: string[] | null;
  collaborators: Collaborator[] | null;
  createdAt: string | null;     // project creation date — used as sort fallback
  developmentStatus: DevelopmentStatus;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}
