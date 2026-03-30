'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import type { ChatMessage } from '@/interfaces/chat';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
  onRetry: (message: ChatMessage) => void;
}

export function MessageBubble({ message, isOwn, showSender, onRetry }: Props) {
  const isPending = message._id.startsWith('temp-') && !message.isError;
  const rawName = message.sender?.displayName ?? message.sender?.name ?? 'Unknown';
  const senderName = rawName.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        mb: showSender ? 1.5 : 0.5,
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          maxWidth: '70%',
          bgcolor: isOwn ? '#2D8060' : '#E8EDF5',
          color: isOwn ? '#fff' : 'text.primary',
          border: message.isError ? '1px solid' : 'none',
          borderColor: message.isError ? 'error.main' : 'transparent',
          opacity: isPending ? 0.6 : 1,
          borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        }}
      >
        {showSender && !isOwn && (
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.25 }}>
            {senderName}
          </Typography>
        )}
        {message.isError && (
          <ErrorOutlineIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle', color: 'error.main' }} />
        )}
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.text}
        </Typography>
      </Paper>
      {isPending && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25 }}>
          sending…
        </Typography>
      )}
      {message.isError && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
          <Typography variant="caption" color="error">
            Failed to send
          </Typography>
          <Button size="small" variant="text" color="error" sx={{ p: 0, minWidth: 0, textTransform: 'none', fontSize: 11 }} onClick={() => onRetry(message)}>
            Retry
          </Button>
        </Box>
      )}
    </Box>
  );
}
