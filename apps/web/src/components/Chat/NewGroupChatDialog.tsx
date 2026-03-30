'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ConversationParticipant } from '@/interfaces/chat';

interface Props {
  open: boolean;
  onClose: () => void;
  participants: ConversationParticipant[];
  onCreate: (participantUids: string[], name: string) => void;
}

export function NewGroupChatDialog({ open, onClose, participants, onCreate }: Props) {
  const [name, setName] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) {
      setName('');
      setSelected(new Set());
    }
  }, [open]);

  const toggle = (uid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  const isDisabled = name.trim().length === 0 || selected.size === 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Group Chat</DialogTitle>
      <DialogContent>
        <TextField
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          sx={{ mb: 2, mt: 1 }}
        />
        {participants.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No other members to add.
          </Typography>
        ) : (
          participants.map((p) => (
            <FormControlLabel
              key={p.uid}
              control={
                <Checkbox
                  checked={selected.has(p.uid)}
                  onChange={() => toggle(p.uid)}
                  size="small"
                />
              }
              label={p.displayName ?? p.name ?? p.uid}
              sx={{ display: 'flex' }}
            />
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={isDisabled}
          onClick={() => onCreate(Array.from(selected), name.trim())}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
