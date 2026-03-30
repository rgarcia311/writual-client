'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import Typography from '@mui/material/Typography';
import GroupIcon from '@mui/icons-material/Group';
import type { ConversationThread } from '@/interfaces/chat';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  thread: ConversationThread;
  isActive: boolean;
  onlineUserIds: string[];
  currentUserUid: string;
  onClick: () => void;
}

export function ThreadListItem({ thread, isActive, onlineUserIds, currentUserUid, onClick }: Props) {
  const isDirect = thread.type === 'direct';
  const other = isDirect ? thread.participants.find((p) => p.uid !== currentUserUid) : null;

  const title = isDirect
    ? (other?.displayName ?? other?.name ?? 'Unknown')
    : (thread.name ?? 'Group Chat');

  const avatarContent = isDirect
    ? title.charAt(0).toUpperCase()
    : null;

  const isMemberOnline = isDirect
    ? onlineUserIds.includes(other?.uid ?? '')
    : false;

  const snippet = thread.lastMessage?.text
    ? thread.lastMessage.text.length > 45
      ? thread.lastMessage.text.slice(0, 45) + '…'
      : thread.lastMessage.text
    : 'No messages yet';
  const timestamp = thread.lastMessage?.createdAt;

  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        bgcolor: isActive ? '#E8F5E9' : 'transparent',
        borderLeft: isActive ? '3px solid #2D8060' : '3px solid transparent',
        py: 1.5,
        px: 1.5,
        alignItems: 'flex-start',
        gap: 1,
        '&:hover': { bgcolor: isActive ? '#E8F5E9' : 'action.hover' },
      }}
    >
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        invisible={!isMemberOnline}
        badgeContent=" "
        sx={{
          flexShrink: 0,
          '& .MuiBadge-badge': {
            bgcolor: '#44b700',
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '2px solid white',
            minWidth: 0,
            padding: 0,
          },
        }}
      >
        <Avatar sx={{ width: 38, height: 38, fontSize: 15 }}>
          {isDirect ? avatarContent : <GroupIcon fontSize="small" />}
        </Avatar>
      </Badge>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {formatTimestamp(timestamp)}
            </Typography>
            {thread.unreadCount > 0 && (
              <Badge
                badgeContent={thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                color="error"
                sx={{ mt: 0.25, '& .MuiBadge-badge': { position: 'static', transform: 'none', fontSize: 10, minWidth: 18, height: 18 } }}
              />
            )}
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {snippet}
        </Typography>
      </Box>
    </ListItemButton>
  );
}
