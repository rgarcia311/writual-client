'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ImageIcon from '@mui/icons-material/Image';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';

interface Props {
  onSend: (text: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, onTyping, disabled }: Props) {
  const [text, setText] = React.useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 0.5,
        px: 2,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <IconButton size="small" disabled={disabled}><EmojiEmotionsIcon fontSize="small" /></IconButton>
      <IconButton size="small" disabled={disabled}><ImageIcon fontSize="small" /></IconButton>
      <IconButton size="small" disabled={disabled}><MicIcon fontSize="small" /></IconButton>
      <TextField
        multiline
        maxRows={4}
        fullWidth
        size="small"
        placeholder="Type a message…"
        value={text}
        disabled={disabled}
        onChange={(e) => { setText(e.target.value); onTyping(); }}
        onKeyDown={handleKeyDown}
        sx={{ mx: 0.5, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
      />
      <IconButton size="small" color="primary" disabled={disabled || !text.trim()} onClick={handleSend}>
        <SendIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
