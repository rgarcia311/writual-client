'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { DialogCloseButton } from '@/shared/DialogCloseButton';
import Typography from '@mui/material/Typography';
import type { Collaborator } from '@/interfaces/collaborator';
import type { SharableScreenplayDocument } from '@hooks/useProjectSharing';
import {
  CollaboratorAccessFields,
  type CollaboratorAccessValue,
} from './CollaboratorAccessFields';
import { useCollaboratorMutations } from './useCollaboratorMutations';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  collaborator: Collaborator;
  /** Who the owner thinks they are editing — the chat knows a display name, the invite only an email. */
  personLabel: string;
  screenplayDocuments: SharableScreenplayDocument[];
}

/**
 * Re-grants one collaborator's access to one project, from wherever their name appears.
 *
 * The chat opens this on a conversation: the owner reads what the other person can do in the
 * header, and changes it without navigating back to the project's share modal.
 */
export function ManageAccessDialog({
  open,
  onClose,
  projectId,
  collaborator,
  personLabel,
  screenplayDocuments,
}: Props) {
  const { updateMutation } = useCollaboratorMutations(projectId);

  const [draft, setDraft] = React.useState<CollaboratorAccessValue>({
    permissionLevel: collaborator.permissionLevel,
    aspects: collaborator.aspects,
    screenplayDocumentIds: collaborator.screenplayDocumentIds ?? [],
  });

  // Reopening on a different person — or after someone else changed the grant — has to start from
  // what is stored now, not from whatever the last edit left behind.
  React.useEffect(() => {
    if (!open) return;
    setDraft({
      permissionLevel: collaborator.permissionLevel,
      aspects: collaborator.aspects,
      screenplayDocumentIds: collaborator.screenplayDocumentIds ?? [],
    });
    updateMutation.reset();
  }, [open, collaborator]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ collaboratorId: collaborator._id, ...draft });
      onClose();
    } catch {
      // Reported by the alert below; the dialog stays open so the edit is not thrown away.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={updateMutation.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogCloseButton
        onClose={onClose}
        disabled={updateMutation.isPending}
        label="Close access settings"
      />
      <DialogTitle sx={{ pb: 0.5, pr: 5 }}>Access for {personLabel}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {collaborator.email}
          {collaborator.status === 'pending' ? ' · invite not accepted yet' : ''}
        </Typography>

        <CollaboratorAccessFields
          value={draft}
          onChange={setDraft}
          screenplayDocuments={screenplayDocuments}
          disabled={updateMutation.isPending}
        />

        {updateMutation.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            Could not save the change. Please try again.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          sx={{ bgcolor: '#2D8060', '&:hover': { bgcolor: '#236348' } }}
        >
          {updateMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
