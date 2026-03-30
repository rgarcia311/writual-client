'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useInfiniteQuery } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import { GET_PROJECT_MESSAGES } from '@/queries/ChatQueries';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import type { ChatMessage } from '@/interfaces/chat';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

interface Props {
  conversationId: string;
  currentUserUid: string;
  onRetry: (message: ChatMessage) => void;
  onMarkAsRead: () => void;
}

export function MessageFeed({ conversationId, currentUserUid, onRetry, onMarkAsRead }: Props) {
  const feedRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const isNearBottom = React.useCallback(() => {
    const el = feedRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam = 0 }) =>
      authRequest<{ getProjectMessages: ChatMessage[] }>(GET_PROJECT_MESSAGES, {
        conversationId,
        limit: 50,
        offset: pageParam,
      }).then((d) => d.getProjectMessages),
    getNextPageParam: (lastPage: ChatMessage[], allPages: ChatMessage[][]) =>
      lastPage.length === 50 ? allPages.flat().length : undefined,
    initialPageParam: 0,
  });

  // Mark as read on mount
  React.useEffect(() => {
    onMarkAsRead();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-to-bottom on new messages if near bottom
  const allMessages = React.useMemo(
    () => (data?.pages ?? []).flat().slice().reverse(),
    [data]
  );
  const latestId = allMessages[allMessages.length - 1]?._id;

  React.useEffect(() => {
    if (isNearBottom()) {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
      onMarkAsRead();
    }
  }, [latestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced scroll handler — mark as read when user reaches bottom
  React.useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isNearBottom()) onMarkAsRead();
      }, 500);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => { clearTimeout(timer); el.removeEventListener('scroll', handler); };
  }, [isNearBottom, onMarkAsRead]);

  // IntersectionObserver for loading older messages
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    const feed = feedRef.current;
    if (!sentinel || !feed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          const prevScrollHeight = feed.scrollHeight;
          fetchNextPage().then(() => {
            requestAnimationFrame(() => {
              feed.scrollTop += feed.scrollHeight - prevScrollHeight;
            });
          });
        }
      },
      { root: feed, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (allMessages.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
        <ChatBubbleOutlineIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
        <Typography variant="body2">No messages yet. Send the first one!</Typography>
      </Box>
    );
  }

  // Build render list with date separators and temporal clustering
  const items: React.ReactNode[] = [];
  let prevDate: string | null = null;
  let prevSenderId: string | null = null;
  let prevCreatedAt: number | null = null;

  if (isFetchingNextPage) {
    items.push(
      <Box key="loading-more" sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  // sentinel at top for infinite scroll
  items.push(<div key="sentinel" ref={sentinelRef} style={{ height: 1 }} />);

  allMessages.forEach((msg, i) => {
    const createdAt = msg.createdAt ?? null;
    const dateLabel = createdAt ? formatDateLabel(createdAt) : null;
    if (dateLabel && dateLabel !== prevDate) {
      items.push(<DateSeparator key={`date-${i}`} label={dateLabel} />);
      prevDate = dateLabel;
    }

    const msgTime = createdAt ? new Date(createdAt).getTime() : null;
    const isNewCluster =
      msg.senderId !== prevSenderId ||
      (prevCreatedAt != null && msgTime != null && msgTime - prevCreatedAt > 5 * 60 * 1000);

    items.push(
      <MessageBubble
        key={msg._id}
        message={msg}
        isOwn={msg.senderId === currentUserUid || msg.sender?.uid === currentUserUid}
        showSender={isNewCluster}
        onRetry={onRetry}
      />
    );

    prevSenderId = msg.senderId;
    prevCreatedAt = msgTime;
  });

  return (
    <Box
      ref={feedRef}
      sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', py: 1 }}
    >
      {/* TODO: virtualize when message count > 300 */}
      {items}
    </Box>
  );
}
