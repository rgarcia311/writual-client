'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import { DialogCloseButton } from '@/shared/DialogCloseButton';
import type { Collaborator, InvitationInput, AspectKey, PermissionLevel } from '@/interfaces/collaborator';
import { ALL_ASPECTS, ASPECT_LABELS } from '@/interfaces/collaborator';
import { useProjectSharing } from '@hooks/useProjectSharing';
import {
  CollaboratorAccessFields,
  useCollaboratorMutations,
  summarizeScreenplayGrant,
  type CollaboratorAccessValue,
} from '@/components/CollaboratorAccess';
import { CollaboratorRow } from './CollaboratorRow';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  collaborators: Collaborator[];
}

/** A new invite starts with the whole project shared, comment-only — the safest useful default. */
const DEFAULT_ACCESS: CollaboratorAccessValue = {
  permissionLevel: 'comment' as PermissionLevel,
  aspects: [...ALL_ASPECTS] as AspectKey[],
  // Empty means every screenplay, including ones added after the invite.
  screenplayDocumentIds: [],
};

export function ShareProjectModal({ open, onClose, projectId, projectTitle, collaborators }: Props) {
  const { screenplayDocuments } = useProjectSharing(open ? projectId : undefined);
  const { inviteMutation, updateMutation, removeMutation } = useCollaboratorMutations(projectId);

  // ── Staged invites (not yet sent) ───────────────────────────────────────
  const [stagedInvites, setStagedInvites] = React.useState<InvitationInput[]>([]);

  // ── Add-collaborator form state ──────────────────────────────────────────
  const [emailInput, setEmailInput] = React.useState('');
  const [emailError, setEmailError] = React.useState('');
  const [access, setAccess] = React.useState<CollaboratorAccessValue>(DEFAULT_ACCESS);

  React.useEffect(() => {
    if (inviteMutation.isSuccess) setStagedInvites([]);
  }, [inviteMutation.isSuccess]);

  const resetForm = () => {
    setEmailInput('');
    setEmailError('');
    setAccess(DEFAULT_ACCESS);
  };

  // ── Add to staged list ───────────────────────────────────────────────────
  const handleAddToList = () => {
    const email = emailInput.toLowerCase().trim();
    if (!EMAIL_REGEX.test(email)) { setEmailError('Enter a valid email address'); return; }
    const alreadyStagedOrActive =
      stagedInvites.some(i => i.email === email) ||
      collaborators.some(c => c.email === email && c.status === 'active');
    if (alreadyStagedOrActive) { setEmailError('This email is already in the list'); return; }
    if (access.aspects.length === 0) { setEmailError('Select at least one aspect'); return; }

    setStagedInvites(prev => [...prev, { email, ...access }]);
    resetForm();
  };

  const removeStagedInvite = (email: string) => {
    setStagedInvites(prev => prev.filter(i => i.email !== email));
  };

  const currentEmailValid = EMAIL_REGEX.test(emailInput.toLowerCase().trim());

  const handleSendInvites = () => {
    let toSend = [...stagedInvites];
    if (currentEmailValid) {
      const email = emailInput.toLowerCase().trim();
      const alreadyIncluded =
        toSend.some(i => i.email === email) ||
        collaborators.some(c => c.email === email && c.status === 'active');
      if (!alreadyIncluded && access.aspects.length > 0) {
        toSend = [...toSend, { email, ...access }];
      }
    }
    if (toSend.length === 0) return;
    inviteMutation.mutate(toSend);
  };

  const handleClose = () => {
    setStagedInvites([]);
    resetForm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      PaperProps={{
        'enable-xr': '',
        style: {
          position: 'relative',
          '--xr-back': '32px',
          '--xr-background-material': 'translucent',
        } as React.CSSProperties,
      }}
    >
      <DialogCloseButton onClose={handleClose} label="Close share project form" />
      <DialogTitle sx={{ pr: 5 }}>Share "{projectTitle}"</DialogTitle>

      <DialogContent dividers>
        {/* ── Section A: Current Collaborators ── */}
        {collaborators.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Current Collaborators
            </Typography>
            <List disablePadding>
              {collaborators.map((collab) => (
                <CollaboratorRow
                  key={collab._id}
                  collab={collab}
                  screenplayDocuments={screenplayDocuments}
                  onUpdate={(next) =>
                    updateMutation.mutate({ collaboratorId: collab._id, ...next })
                  }
                  onRemove={() => removeMutation.mutate(collab._id)}
                  loading={updateMutation.isPending || removeMutation.isPending}
                />
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
          </>
        )}

        {/* ── Section B: Add Collaborators ── */}
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary' }}>
          Add Collaborators
        </Typography>

        <TextField
          label="Email address"
          type="email"
          value={emailInput}
          onChange={(e) => { setEmailInput(e.target.value); setEmailError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddToList(); } }}
          error={!!emailError}
          helperText={emailError}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
        />

        <CollaboratorAccessFields
          value={access}
          onChange={setAccess}
          screenplayDocuments={screenplayDocuments}
        />

        <Button variant="outlined" size="small" onClick={handleAddToList} sx={{ mt: 1, mb: 2 }}>
          Add to list
        </Button>

        {/* Staged invite preview */}
        {stagedInvites.length > 0 && (
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1, mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Ready to send ({stagedInvites.length})
            </Typography>
            {stagedInvites.map(inv => (
              <Box key={inv.email} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.25 }}>
                <Box>
                  <Typography variant="body2" component="span">{inv.email}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {describeStagedInvite(inv, screenplayDocuments)}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => removeStagedInvite(inv.email)}>
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        {inviteMutation.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            Failed to send invites. Please try again.
          </Alert>
        )}
        {inviteMutation.isSuccess && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Invites sent successfully.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSendInvites}
          disabled={(stagedInvites.length === 0 && !currentEmailValid) || inviteMutation.isPending}
          sx={{ bgcolor: '#2D8060', '&:hover': { bgcolor: '#236348' } }}
        >
          {inviteMutation.isPending ? 'Sending…' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** "Edit · Characters, Outline · Draft 2" — what the invite about to go out actually grants. */
function describeStagedInvite(
  invite: InvitationInput,
  screenplayDocuments: Parameters<typeof summarizeScreenplayGrant>[1],
): string {
  const screenplayGrant = summarizeScreenplayGrant(invite, screenplayDocuments);
  const aspects = (screenplayGrant ? invite.aspects.filter(a => a !== 'screenplay') : invite.aspects)
    .map(a => ASPECT_LABELS[a]);
  return [
    invite.permissionLevel === 'edit' ? 'Edit' : 'Comment',
    [...aspects, screenplayGrant].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');
}
