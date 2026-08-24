'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Collaborator } from '@/interfaces/collaborator';
import type { SharableScreenplayDocument } from '@hooks/useProjectSharing';
import {
  CollaboratorAccessFields,
  CollaboratorAccessSummary,
  type CollaboratorAccessValue,
} from '@/components/CollaboratorAccess';

interface Props {
  collab: Collaborator;
  screenplayDocuments: SharableScreenplayDocument[];
  onUpdate: (access: CollaboratorAccessValue) => void;
  onRemove: () => void;
  loading: boolean;
}

/** One existing collaborator: what they were granted, and an inline editor to re-grant it. */
export function CollaboratorRow({
  collab,
  screenplayDocuments,
  onUpdate,
  onRemove,
  loading,
}: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [draft, setDraft] = React.useState<CollaboratorAccessValue>({
    permissionLevel: collab.permissionLevel,
    aspects: collab.aspects,
    screenplayDocumentIds: collab.screenplayDocumentIds ?? [],
  });

  // Opening the editor starts from what is stored now — the row may have been re-granted from the
  // chat since this modal was mounted.
  const handleToggle = () => {
    if (!expanded) {
      setDraft({
        permissionLevel: collab.permissionLevel,
        aspects: collab.aspects,
        screenplayDocumentIds: collab.screenplayDocumentIds ?? [],
      });
    }
    setExpanded((e) => !e);
  };

  return (
    <ListItem
      disablePadding
      sx={{ flexDirection: 'column', alignItems: 'stretch', mb: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <ListItemText
          primary={collab.email}
          secondaryTypographyProps={{ component: 'div' }}
          secondary={
            <CollaboratorAccessSummary
              collaborator={collab}
              screenplayDocuments={screenplayDocuments}
              showStatus
            />
          }
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" onClick={handleToggle} sx={{ fontSize: 11, minWidth: 0, px: 1 }}>
            {expanded ? 'Done' : 'Edit'}
          </Button>
          <IconButton size="small" onClick={onRemove} disabled={loading}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {expanded && (
        <Box sx={{ mt: 1 }}>
          <CollaboratorAccessFields
            value={draft}
            onChange={setDraft}
            screenplayDocuments={screenplayDocuments}
            disabled={loading}
            dense
          />
          <Button
            size="small"
            variant="contained"
            disabled={loading}
            onClick={() => { onUpdate(draft); setExpanded(false); }}
            sx={{ mt: 1, bgcolor: '#2D8060', '&:hover': { bgcolor: '#236348' } }}
          >
            Save
          </Button>
        </Box>
      )}
    </ListItem>
  );
}
