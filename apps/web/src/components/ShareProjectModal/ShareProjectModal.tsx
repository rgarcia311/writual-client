'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRequest } from '@/lib/authRequest';
import {
  INVITE_COLLABORATORS,
  UPDATE_COLLABORATOR,
  REMOVE_COLLABORATOR,
} from '@/mutations/ShareMutations';
import type { Collaborator, InvitationInput, AspectKey, PermissionLevel } from '@/interfaces/collaborator';
import { ALL_ASPECTS, ASPECT_LABELS } from '@/interfaces/collaborator';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  collaborators: Collaborator[];
}

const DEFAULT_PERMISSION: PermissionLevel = 'comment';
const DEFAULT_ASPECTS: AspectKey[] = [...ALL_ASPECTS];

export function ShareProjectModal({ open, onClose, projectId, projectTitle, collaborators }: Props) {
  const queryClient = useQueryClient();

  // ── Staged invites (not yet sent) ───────────────────────────────────────
  const [stagedInvites, setStagedInvites] = React.useState<InvitationInput[]>([]);

  // ── Add-collaborator form state ──────────────────────────────────────────
  const [emailInput, setEmailInput] = React.useState('');
  const [emailError, setEmailError] = React.useState('');
  const [permission, setPermission] = React.useState<PermissionLevel>(DEFAULT_PERMISSION);
  const [selectedAspects, setSelectedAspects] = React.useState<AspectKey[]>(DEFAULT_ASPECTS);

  // ── API mutations ────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['projectChats'] });
  };

  const inviteMutation = useMutation({
    mutationFn: (invitations: InvitationInput[]) =>
      authRequest(INVITE_COLLABORATORS, { projectId, invitations }),
    onSuccess: () => { invalidate(); setStagedInvites([]); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ collaboratorId, permissionLevel, aspects }: { collaboratorId: string; permissionLevel: string; aspects: string[] }) =>
      authRequest(UPDATE_COLLABORATOR, { projectId, collaboratorId, permissionLevel, aspects }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (collaboratorId: string) =>
      authRequest(REMOVE_COLLABORATOR, { projectId, collaboratorId }),
    onSuccess: invalidate,
  });

  // ── Aspect helpers ───────────────────────────────────────────────────────
  const toggleAspect = (aspect: AspectKey) => {
    setSelectedAspects(prev =>
      prev.includes(aspect) ? prev.filter(a => a !== aspect) : [...prev, aspect]
    );
  };

  const allSelected = selectedAspects.length === ALL_ASPECTS.length;
  const toggleAll = () => setSelectedAspects(allSelected ? [] : [...ALL_ASPECTS]);

  // ── Add to staged list ───────────────────────────────────────────────────
  const handleAddToList = () => {
    const email = emailInput.toLowerCase().trim();
    if (!EMAIL_REGEX.test(email)) { setEmailError('Enter a valid email address'); return; }
    const alreadyStagedOrActive =
      stagedInvites.some(i => i.email === email) ||
      collaborators.some(c => c.email === email && c.status === 'active');
    if (alreadyStagedOrActive) { setEmailError('This email is already in the list'); return; }
    if (selectedAspects.length === 0) { setEmailError('Select at least one aspect'); return; }

    setStagedInvites(prev => [...prev, { email, permissionLevel: permission, aspects: selectedAspects }]);
    setEmailInput('');
    setEmailError('');
    setPermission(DEFAULT_PERMISSION);
    setSelectedAspects(DEFAULT_ASPECTS);
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
      if (!alreadyIncluded && selectedAspects.length > 0) {
        toSend = [...toSend, { email, permissionLevel: permission, aspects: selectedAspects }];
      }
    }
    if (toSend.length === 0) return;
    inviteMutation.mutate(toSend);
  };

  const handleClose = () => {
    setStagedInvites([]);
    setEmailInput('');
    setEmailError('');
    setPermission(DEFAULT_PERMISSION);
    setSelectedAspects(DEFAULT_ASPECTS);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Share "{projectTitle}"
        <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

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
                  onUpdate={(permissionLevel, aspects) =>
                    updateMutation.mutate({ collaboratorId: collab._id, permissionLevel, aspects })
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

        <Typography variant="caption" color="text.secondary">Permission</Typography>
        <ToggleButtonGroup
          value={permission}
          exclusive
          onChange={(_, v) => { if (v) setPermission(v); }}
          size="small"
          sx={{ mt: 0.5, mb: 2, display: 'flex' }}
        >
          <ToggleButton value="edit" sx={{ flex: 1 }}>Collaborate</ToggleButton>
          <ToggleButton value="comment" sx={{ flex: 1 }}>Comment Only</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="caption" color="text.secondary">Aspects to share</Typography>
        <FormGroup sx={{ mt: 0.5, mb: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={allSelected} indeterminate={selectedAspects.length > 0 && !allSelected} onChange={toggleAll} size="small" />}
            label={<Typography variant="body2">Select all</Typography>}
          />
          {ALL_ASPECTS.map(aspect => (
            <FormControlLabel
              key={aspect}
              control={<Checkbox checked={selectedAspects.includes(aspect)} onChange={() => toggleAspect(aspect)} size="small" />}
              label={<Typography variant="body2">{ASPECT_LABELS[aspect]}</Typography>}
            />
          ))}
        </FormGroup>

        <Button variant="outlined" size="small" onClick={handleAddToList} sx={{ mb: 2 }}>
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
                    {inv.permissionLevel === 'edit' ? 'Edit' : 'Comment'} · {inv.aspects.map(a => ASPECT_LABELS[a]).join(', ')}
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

// ─── CollaboratorRow ─────────────────────────────────────────────────────────

interface CollaboratorRowProps {
  collab: Collaborator;
  onUpdate: (permissionLevel: string, aspects: string[]) => void;
  onRemove: () => void;
  loading: boolean;
}

function CollaboratorRow({ collab, onUpdate, onRemove, loading }: CollaboratorRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [localPermission, setLocalPermission] = React.useState<PermissionLevel>(collab.permissionLevel);
  const [localAspects, setLocalAspects] = React.useState<AspectKey[]>(collab.aspects);

  const toggleAspect = (aspect: AspectKey) => {
    setLocalAspects(prev => prev.includes(aspect) ? prev.filter(a => a !== aspect) : [...prev, aspect]);
  };

  return (
    <ListItem
      disablePadding
      sx={{ flexDirection: 'column', alignItems: 'stretch', mb: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <ListItemText
          primary={collab.email}
          secondary={
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
              <Chip
                label={collab.status === 'pending' ? 'Pending' : 'Active'}
                size="small"
                sx={{ bgcolor: collab.status === 'pending' ? '#FFF3E0' : '#E8F5E9', color: collab.status === 'pending' ? '#E65100' : '#1B5E20', fontSize: 11 }}
              />
              <Chip label={collab.permissionLevel === 'edit' ? 'Edit' : 'Comment'} size="small" variant="outlined" sx={{ fontSize: 11 }} />
            </Box>
          }
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" onClick={() => setExpanded(e => !e)} sx={{ fontSize: 11, minWidth: 0, px: 1 }}>
            {expanded ? 'Done' : 'Edit'}
          </Button>
          <IconButton size="small" onClick={onRemove} disabled={loading}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {expanded && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">Permission</Typography>
          <ToggleButtonGroup
            value={localPermission}
            exclusive
            onChange={(_, v) => { if (v) setLocalPermission(v); }}
            size="small"
            sx={{ mt: 0.5, mb: 1.5, display: 'flex' }}
          >
            <ToggleButton value="edit" sx={{ flex: 1, fontSize: 11 }}>Collaborate</ToggleButton>
            <ToggleButton value="comment" sx={{ flex: 1, fontSize: 11 }}>Comment Only</ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary">Aspects</Typography>
          <FormGroup sx={{ mt: 0.25, mb: 1 }}>
            {ALL_ASPECTS.map(aspect => (
              <FormControlLabel
                key={aspect}
                control={<Checkbox checked={localAspects.includes(aspect)} onChange={() => toggleAspect(aspect)} size="small" />}
                label={<Typography variant="body2">{ASPECT_LABELS[aspect]}</Typography>}
              />
            ))}
          </FormGroup>

          <Button
            size="small"
            variant="contained"
            disabled={loading}
            onClick={() => { onUpdate(localPermission, localAspects); setExpanded(false); }}
            sx={{ bgcolor: '#2D8060', '&:hover': { bgcolor: '#236348' } }}
          >
            Save
          </Button>
        </Box>
      )}
    </ListItem>
  );
}
