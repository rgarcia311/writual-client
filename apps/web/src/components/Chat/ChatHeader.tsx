'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import GroupIcon from '@mui/icons-material/Group';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { ConversationThread } from '@/interfaces/chat';

interface Props {
  thread: ConversationThread | undefined;
  currentUserUid: string;
  typingUsers: string[];
  onMenuClick: () => void;
  onLeaveConversation?: () => void;
}

export function ChatHeader({ thread, currentUserUid, typingUsers, onMenuClick, onLeaveConversation }: Props) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const typingText = typingUsers.length === 1
    ? `${typingUsers[0]} is typing…`
    : typingUsers.length > 1
      ? `${typingUsers.length} people are typing…`
      : null;

  const isDirect = thread?.type === 'direct';
  const isGeneral = thread?.name === 'General';

  const other = isDirect
    ? thread?.participants.find((p) => p.uid !== currentUserUid)
    : null;

  const title = isDirect
    ? (other?.displayName ?? other?.name ?? 'Unknown')
    : (thread?.name ?? 'Group Chat');

  const subtitle = !isDirect && thread
    ? thread.participants
        .map((p) => p.displayName ?? p.name ?? p.uid)
        .join(', ')
    : null;

  const avatarContent = isDirect
    ? title.charAt(0).toUpperCase()
    : null;

  const canShowMenu = thread && !isDirect && !isGeneral;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
        minHeight: 64,
      }}
    >
      <IconButton sx={{ display: { sm: 'none' } }} onClick={onMenuClick} size="small">
        <MenuIcon />
      </IconButton>
      {thread && (
        <Avatar sx={{ width: 40, height: 40 }}>
          {isDirect ? avatarContent : <GroupIcon fontSize="small" />}
        </Avatar>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {thread ? title : 'Select a conversation'}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {subtitle}
          </Typography>
        )}
        {typingText && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {typingText}
          </Typography>
        )}
      </Box>
      {canShowMenu && (
        <>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary' }}>
              Members
            </MenuItem>
            {thread?.participants.map((p) => (
              <MenuItem key={p.uid} disabled sx={{ fontSize: 13 }}>
                {p.displayName ?? p.name ?? p.uid}
              </MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                onLeaveConversation?.();
              }}
              sx={{ color: 'error.main', mt: 1 }}
            >
              Leave Group
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
}
