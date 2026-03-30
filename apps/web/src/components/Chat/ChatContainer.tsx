'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ForumIcon from '@mui/icons-material/Forum';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import { GET_PROJECT_CONVERSATIONS } from '@/queries/ChatQueries';
import { SEND_MESSAGE, MARK_AS_READ, CREATE_GROUP_CONVERSATION, LEAVE_CONVERSATION } from '@/mutations/ChatMutations';
import { useUserProfileStore } from '@/state/user';
import { usePusher } from '@/hooks/usePusher';
import { usePresence } from '@/hooks/usePresence';
import { ThreadList } from './ThreadList';
import { ChatHeader } from './ChatHeader';
import { MessageFeed } from './MessageFeed';
import { MessageInput } from './MessageInput';
import { NewGroupChatDialog } from './NewGroupChatDialog';
import type { ChatMessage, ConversationThread, ConversationParticipant } from '@/interfaces/chat';

interface Props {
  projectId: string;
}

export function ChatContainer({ projectId }: Props) {
  const queryClient = useQueryClient();
  const userProfile = useUserProfileStore((s) => s.userProfile);
  const currentUserUid = userProfile?.user ?? '';

  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = React.useState(false);
  const hasAutoSelected = React.useRef(false);

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['projectConversations', projectId],
    queryFn: () =>
      authRequest<{ getProjectConversations: ConversationThread[] }>(GET_PROJECT_CONVERSATIONS, { projectId })
        .then((d) => d.getProjectConversations),
  });

  const conversations = conversationsData ?? [];
  const selectedThread = conversations.find((t) => t._id === selectedConversationId) ?? null;

  // Auto-select General conversation on first load
  React.useEffect(() => {
    if (!hasAutoSelected.current && conversations.length > 0) {
      hasAutoSelected.current = true;
      setSelectedConversationId(conversations[0]._id);
    }
  }, [conversations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  usePusher(selectedConversationId, projectId);
  const { typingUsers, onlineUserIds, sendTypingEvent } = usePresence(projectId);

  const sendMutation = useMutation({
    mutationFn: (vars: { conversationId: string; text: string; clientGeneratedId: string }) =>
      authRequest(SEND_MESSAGE, vars),
    onMutate: async ({ conversationId, text, clientGeneratedId }) => {
      const tempId = `temp-${clientGeneratedId}`;
      const tempMsg: ChatMessage = {
        _id: tempId,
        text,
        senderId: currentUserUid,
        projectId: selectedThread?.projectId ?? projectId,
        createdAt: new Date().toISOString(),
        clientGeneratedId,
        sender: {
          uid: currentUserUid,
          name: userProfile?.name ?? null,
          displayName: userProfile?.displayName ?? null,
        },
      };
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return old;
        const firstPage = old.pages[0] ?? [];
        if (firstPage.some((m: ChatMessage) => m.clientGeneratedId === clientGeneratedId)) return old;
        return { ...old, pages: [[tempMsg, ...firstPage], ...old.pages.slice(1)] };
      });
      return { tempId, clientGeneratedId };
    },
    onError: (_err, vars, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData(['messages', vars.conversationId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: ChatMessage[]) =>
            page.map((m) => m.clientGeneratedId === ctx.clientGeneratedId ? { ...m, isError: true } : m)
          ),
        };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectConversations', projectId] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (conversationId: string) => authRequest(MARK_AS_READ, { conversationId }),
  });

  const handleMarkAsRead = React.useCallback(() => {
    if (!selectedConversationId) return;
    queryClient.setQueryData(['projectConversations', projectId], (old: ConversationThread[] | undefined) =>
      old?.map((t) => (t._id === selectedConversationId ? { ...t, unreadCount: 0 } : t))
    );
    markAsReadMutation.mutate(selectedConversationId);
  }, [selectedConversationId, projectId, queryClient, markAsReadMutation]);

  React.useEffect(() => {
    if (selectedConversationId) handleMarkAsRead();
  }, [selectedConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = React.useCallback((text: string) => {
    if (!selectedConversationId) return;
    const clientGeneratedId = crypto.randomUUID();
    sendMutation.mutate({ conversationId: selectedConversationId, text, clientGeneratedId });
  }, [selectedConversationId, sendMutation]);

  const handleRetry = React.useCallback((message: ChatMessage) => {
    if (!message.clientGeneratedId || !selectedConversationId) return;
    queryClient.setQueryData(['messages', selectedConversationId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: ChatMessage[]) =>
          page.map((m) => m.clientGeneratedId === message.clientGeneratedId ? { ...m, isError: false } : m)
        ),
      };
    });
    sendMutation.mutate({
      conversationId: selectedConversationId,
      text: message.text,
      clientGeneratedId: message.clientGeneratedId,
    });
  }, [selectedConversationId, queryClient, sendMutation]);

  const createGroupMutation = useMutation({
    mutationFn: (vars: { participantUids: string[]; name: string }) =>
      authRequest(CREATE_GROUP_CONVERSATION, { projectId, ...vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectConversations', projectId] });
      setIsGroupDialogOpen(false);
    },
  });

  const leaveConversationMutation = useMutation({
    mutationFn: (conversationId: string) => authRequest(LEAVE_CONVERSATION, { conversationId }),
    onSuccess: (_data, conversationId) => {
      queryClient.setQueryData(['projectConversations', projectId], (old: ConversationThread[] | undefined) =>
        old?.filter((t) => t._id !== conversationId)
      );
      setSelectedConversationId(null);
      hasAutoSelected.current = false;
    },
  });

  // Participants available for group chat creation (other users with DMs)
  const dialogParticipants: ConversationParticipant[] = React.useMemo(() => {
    const seen = new Set<string>();
    const result: ConversationParticipant[] = [];
    for (const conv of conversations) {
      if (conv.type === 'direct') {
        const other = conv.participants.find((p) => p.uid !== currentUserUid);
        if (other && !seen.has(other.uid)) {
          seen.add(other.uid);
          result.push(other);
        }
      }
    }
    return result;
  }, [conversations, currentUserUid]);

  const handleSelectThread = (id: string) => {
    setSelectedConversationId(id);
    setIsMobileDrawerOpen(false);
  };

  const threadListContent = (
    <ThreadList
      threads={conversations}
      selectedConversationId={selectedConversationId}
      onlineUserIds={onlineUserIds}
      currentUserUid={currentUserUid}
      projectId={projectId}
      onSelect={handleSelectThread}
      onNewGroupChat={() => setIsGroupDialogOpen(true)}
    />
  );

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', p: 1, gap: 1 }}>
      {/* Desktop thread list */}
      {threadListContent}

      {/* Mobile drawer */}
      <Drawer
        anchor="left"
        open={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        sx={{ display: { sm: 'none' }, '& .MuiDrawer-paper': { width: 300 } }}
      >
        <ThreadList
          threads={conversations}
          selectedConversationId={selectedConversationId}
          onlineUserIds={onlineUserIds}
          currentUserUid={currentUserUid}
          projectId={projectId}
          onSelect={handleSelectThread}
          onNewGroupChat={() => setIsGroupDialogOpen(true)}
        />
      </Drawer>

      {/* Right pane */}
      <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, borderRadius: '10px' }}>
        {conversationsLoading ? null : !selectedThread ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
            <ForumIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">Select a conversation to start collaborating</Typography>
            <Typography variant="body2">Your conversations will appear on the left</Typography>
          </Box>
        ) : (
          <>
            <ChatHeader
              thread={selectedThread}
              currentUserUid={currentUserUid}
              typingUsers={typingUsers}
              onMenuClick={() => setIsMobileDrawerOpen(true)}
              onLeaveConversation={() => leaveConversationMutation.mutate(selectedThread._id)}
            />
            <MessageFeed
              conversationId={selectedConversationId!}
              currentUserUid={currentUserUid}
              onRetry={handleRetry}
              onMarkAsRead={handleMarkAsRead}
            />
            <MessageInput
              onSend={handleSend}
              onTyping={sendTypingEvent}
            />
          </>
        )}
      </Paper>

      <NewGroupChatDialog
        open={isGroupDialogOpen}
        onClose={() => setIsGroupDialogOpen(false)}
        participants={dialogParticipants}
        onCreate={(participantUids, name) => createGroupMutation.mutate({ participantUids, name })}
      />
    </Box>
  );
}
