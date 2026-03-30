'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { ThreadListItem } from './ThreadListItem';
import type { ConversationThread } from '@/interfaces/chat';

interface Props {
  threads: ConversationThread[];
  selectedConversationId: string | null;
  onlineUserIds: string[];
  currentUserUid: string;
  projectId: string;
  onSelect: (id: string) => void;
  onNewGroupChat: () => void;
}

export function ThreadList({ threads, selectedConversationId, onlineUserIds, currentUserUid, projectId, onSelect, onNewGroupChat }: Props) {
  const [search, setSearch] = React.useState('');

  const sorted = [...threads].sort((a, b) => {
    const aDate = a.lastMessage?.createdAt ?? '0';
    const bDate = b.lastMessage?.createdAt ?? '0';
    return bDate < aDate ? -1 : bDate > aDate ? 1 : 0;
  });

  const lower = search.trim().toLowerCase();
  const filtered = lower
    ? sorted.filter((t) => {
        if (t.type === 'group') {
          return (t.name ?? '').toLowerCase().includes(lower);
        }
        const other = t.participants.find((p) => p.uid !== currentUserUid);
        return (other?.displayName ?? other?.name ?? '').toLowerCase().includes(lower);
      })
    : sorted;

  const hasDms = threads.some((t) => t.type === 'direct');

  return (
    <Paper
      elevation={2}
      sx={{
        width: 350,
        height: '100%',
        bgcolor: '#F7F7F7',
        flexShrink: 0,
        display: { xs: 'none', sm: 'flex' },
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '10px',
      }}
    >
      <Box
        sx={{
          px: 1.5,
          pt: 1.5,
          pb: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Conversations
        </Typography>
        <Tooltip title="New Group Chat">
          <IconButton size="small" onClick={onNewGroupChat}>
            <GroupAddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search conversations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && search ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            No results.
          </Typography>
        ) : !hasDms && !search ? (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, mt: 2 }}>
            <PersonAddIcon sx={{ fontSize: 40, color: 'text.disabled', opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Invite collaborators to start a conversation
            </Typography>
            <Button
              size="small"
              variant="outlined"
              href={`/project/${projectId}`}
              sx={{ borderRadius: 3 }}
            >
              Invite collaborators
            </Button>
          </Box>
        ) : (
          filtered.map((thread) => (
            <ThreadListItem
              key={thread._id}
              thread={thread}
              isActive={thread._id === selectedConversationId}
              onlineUserIds={onlineUserIds}
              currentUserUid={currentUserUid}
              onClick={() => onSelect(thread._id)}
            />
          ))
        )}
      </Box>
    </Paper>
  );
}
