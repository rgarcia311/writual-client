'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ForumIcon from '@mui/icons-material/Forum';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import { SEND_MESSAGE, MARK_AS_READ, CREATE_GROUP_CONVERSATION, LEAVE_CONVERSATION } from '@/mutations/ChatMutations';
import { useUserProfileStore } from '@/state/user';
import { usePusher } from '@/hooks/usePusher';
import { usePresence } from '@/hooks/usePresence';
import { useProjectSharing } from '@/hooks/useProjectSharing';
import { useProjectConversations } from '@/hooks/useProjectConversations';
import { useChatNotificationsStore } from '@/state/chatNotifications';
import { ThreadList } from './ThreadList';
import { ChatHeader } from './ChatHeader';
import { MessageFeed } from './MessageFeed';
import { MessageInput } from './MessageInput';
import { NewGroupChatDialog } from './NewGroupChatDialog';
import type { ChatMessage, ConversationThread, ConversationParticipant } from '@/interfaces/chat';
import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useProjectShellContext } from '@/components/ProjectFloat';
import '@/styles/chatPage.css';

interface Props {
  projectId: string;
}

export function ChatContainer({ projectId }: Props) {
  const queryClient = useQueryClient();
  const userProfile = useUserProfileStore((s) => s.userProfile);
  const currentUserUid = userProfile?.user ?? '';

  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = React.useState(false);
  const hasAutoSelected = React.useRef(false);
  // A thread the user tapped themselves — the only thing that opens the full-screen thread view
  // on mobile, so an auto-selection made before the media query resolved can be undone.
  const hasUserSelected = React.useRef(false);

  const isMobile = useIsMobile();
  const { projectTitle } = useProjectShellContext();

  const { data: conversationsData, isLoading: conversationsLoading } = useProjectConversations(projectId);

  const conversations = conversationsData ?? [];
  const selectedThread = conversations.find((t) => t._id === selectedConversationId) ?? null;

  // Auto-select General conversation on first load. Mobile opens on the conversation list instead:
  // the two panes take turns owning the screen there, so a thread opens only on a tap.
  React.useEffect(() => {
    if (isMobile) {
      if (!hasUserSelected.current) setSelectedConversationId(null);
      return;
    }
    if (!hasAutoSelected.current && conversations.length > 0) {
      hasAutoSelected.current = true;
      setSelectedConversationId(conversations[0]._id);
    }
  }, [conversations.length, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // A notification banner links straight to the thread it belongs to. Read from `location` rather
  // than `useSearchParams` so this stays out of the route's render path — it is a one-time hint at
  // mount, not state the page tracks.
  const [deepLinkedConversationId] = React.useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('conversation'),
  );

  React.useEffect(() => {
    if (!deepLinkedConversationId) return;
    if (!conversations.some((t) => t._id === deepLinkedConversationId)) return;
    // Counts as a deliberate choice, so mobile opens the thread rather than the list.
    hasUserSelected.current = true;
    hasAutoSelected.current = true;
    setSelectedConversationId(deepLinkedConversationId);
  }, [deepLinkedConversationId, conversations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  usePusher(selectedConversationId, projectId);

  // Tells `useChatNotifications` which thread is on screen, so a message arriving in it neither
  // raises the side nav badge nor fires an OS banner for something already being read.
  const setActiveConversationId = useChatNotificationsStore((s) => s.setActiveConversationId);
  React.useEffect(() => {
    setActiveConversationId(selectedConversationId);
    return () => setActiveConversationId(null);
  }, [selectedConversationId, setActiveConversationId]);
  const { typingUsers, onlineUserIds, sendTypingEvent } = usePresence(projectId);

  // Who else is on this project and what they were granted — the chat labels every conversation
  // with it, and lets the owner change it without leaving the page.
  const { participantAccess, screenplayDocuments, isViewerOwner } = useProjectSharing(projectId);

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
          email: userProfile?.email ?? null,
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
    hasUserSelected.current = true;
    setSelectedConversationId(id);
  };

  const handleBackToList = () => {
    hasUserSelected.current = false;
    setSelectedConversationId(null);
  };

  // Mobile is one pane at a time: the list until a thread is tapped, then the thread until Back.
  const showThreadListOnMobile = !selectedConversationId;

  const threadListContent = (
    <ThreadList
      threads={conversations}
      selectedConversationId={selectedConversationId}
      onlineUserIds={onlineUserIds}
      currentUserUid={currentUserUid}
      projectId={projectId}
      projectTitle={projectTitle}
      showOnMobile={showThreadListOnMobile}
      participantAccess={participantAccess}
      onSelect={handleSelectThread}
      onNewGroupChat={() => setIsGroupDialogOpen(true)}
    />
  );

  return (
    <Box sx={{ display: 'flex', flex: 1, width: '100%', minWidth: 0, minHeight: 0, gap: 1 }}>
      {threadListContent}

      {/* Right pane */}
      <Paper
        elevation={2}
        enable-xr=""
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
          minHeight: 0,
          borderRadius: '10px',
          // The list owns the whole screen until a thread is opened; the open thread then runs
          // edge to edge, so its radius goes too.
          [`@media ${MOBILE_MEDIA_QUERY}`]: showThreadListOnMobile
            ? { display: 'none' }
            : { borderRadius: 0 },
        }}
        style={
          {
            '--xr-back': '16px',
            '--xr-background-material': 'translucent',
          } as React.CSSProperties
        }
      >
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
              projectId={projectId}
              participantAccess={participantAccess}
              screenplayDocuments={screenplayDocuments}
              canManageAccess={isViewerOwner}
              onBack={handleBackToList}
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
