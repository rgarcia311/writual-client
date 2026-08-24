'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {
  ALL_ASPECTS,
  ASPECT_LABELS,
  type AspectKey,
  type PermissionLevel,
} from '@/interfaces/collaborator';
import type { SharableScreenplayDocument } from '@hooks/useProjectSharing';

/** Everything an owner can grant one person on one project. */
export interface CollaboratorAccessValue {
  permissionLevel: PermissionLevel;
  aspects: AspectKey[];
  /** Empty means every screenplay document, including ones added later. */
  screenplayDocumentIds: string[];
}

interface Props {
  value: CollaboratorAccessValue;
  onChange: (next: CollaboratorAccessValue) => void;
  /** The project's screenplays, in tab order — the documents a grant may name. */
  screenplayDocuments: SharableScreenplayDocument[];
  disabled?: boolean;
  /** `true` inside the share modal's inline row, where vertical space is tight. */
  dense?: boolean;
}

/**
 * Permission level, project aspects, and — when the screenplay aspect is on — which of the
 * project's screenplays the person reaches.
 *
 * Shared by the share modal and the chat's manage-access dialog so both offer exactly the same
 * grant, and so a change to what can be shared only has to be made once.
 */
export function CollaboratorAccessFields({
  value,
  onChange,
  screenplayDocuments,
  disabled = false,
  dense = false,
}: Props) {
  const labelVariant = dense ? 'body2' : 'body1';
  const toggleFontSize = dense ? 11 : undefined;

  const setAspects = (aspects: AspectKey[]) => {
    // Revoking the screenplay aspect drops any per-document grant with it, so re-granting later
    // starts from "all screenplays" rather than resurrecting a stale selection.
    const keepsScreenplay = aspects.includes('screenplay');
    onChange({
      ...value,
      aspects,
      screenplayDocumentIds: keepsScreenplay ? value.screenplayDocumentIds : [],
    });
  };

  const toggleAspect = (aspect: AspectKey) =>
    setAspects(
      value.aspects.includes(aspect)
        ? value.aspects.filter((a) => a !== aspect)
        : [...value.aspects, aspect],
    );

  const allAspectsSelected = ALL_ASPECTS.every((aspect) => value.aspects.includes(aspect));
  const someAspectsSelected = value.aspects.length > 0 && !allAspectsSelected;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">Permission</Typography>
      <ToggleButtonGroup
        value={value.permissionLevel}
        exclusive
        disabled={disabled}
        onChange={(_, next: PermissionLevel | null) => {
          if (next) onChange({ ...value, permissionLevel: next });
        }}
        size="small"
        sx={{ mt: 0.5, mb: dense ? 1.5 : 2, display: 'flex' }}
      >
        <ToggleButton value="edit" sx={{ flex: 1, fontSize: toggleFontSize }}>Collaborate</ToggleButton>
        <ToggleButton value="comment" sx={{ flex: 1, fontSize: toggleFontSize }}>Comment Only</ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="caption" color="text.secondary">Aspects to share</Typography>
      <FormGroup sx={{ mt: 0.25, mb: 1 }}>
        <FormControlLabel
          disabled={disabled}
          control={
            <Checkbox
              size="small"
              checked={allAspectsSelected}
              indeterminate={someAspectsSelected}
              onChange={() => setAspects(allAspectsSelected ? [] : [...ALL_ASPECTS])}
            />
          }
          label={<Typography variant={labelVariant}>Select all</Typography>}
        />
        {ALL_ASPECTS.map((aspect) => (
          <FormControlLabel
            key={aspect}
            disabled={disabled}
            control={
              <Checkbox
                size="small"
                checked={value.aspects.includes(aspect)}
                onChange={() => toggleAspect(aspect)}
              />
            }
            label={<Typography variant={labelVariant}>{ASPECT_LABELS[aspect]}</Typography>}
          />
        ))}
      </FormGroup>

      {value.aspects.includes('screenplay') && (
        <ScreenplayDocumentGrant
          selectedIds={value.screenplayDocumentIds}
          documents={screenplayDocuments}
          disabled={disabled}
          dense={dense}
          onChange={(screenplayDocumentIds) => onChange({ ...value, screenplayDocumentIds })}
        />
      )}
    </Box>
  );
}

interface GrantProps {
  selectedIds: string[];
  documents: SharableScreenplayDocument[];
  disabled: boolean;
  dense: boolean;
  onChange: (next: string[]) => void;
}

/**
 * Which screenplays the grant covers.
 *
 * "All screenplays" is stored as an empty list rather than as every id, which is what keeps a
 * collaborator on drafts the writer has not written yet. Picking every document by hand therefore
 * collapses back to "all" — the same thing the server would store — so the control never claims a
 * narrower grant than what is actually saved.
 */
function ScreenplayDocumentGrant({ selectedIds, documents, disabled, dense, onChange }: GrantProps) {
  const grantsAll = selectedIds.length === 0;

  // Nothing to choose between until the project has a second screenplay; the aspect checkbox above
  // already says everything there is to say about access to a single script.
  if (documents.length < 2) return null;

  const toggleDocument = (documentId: string) => {
    const next = selectedIds.includes(documentId)
      ? selectedIds.filter((id) => id !== documentId)
      : [...selectedIds, documentId];
    // Every box ticked is "all"; an empty list would read as "all" too, so the last remaining
    // document cannot be unticked (its checkbox is disabled below).
    onChange(next.length === documents.length ? [] : next);
  };

  return (
    <Box sx={{ mt: 0.5 }}>
      <Typography variant="caption" color="text.secondary">Screenplays</Typography>
      <FormGroup sx={{ mt: 0.25 }}>
        <FormControlLabel
          disabled={disabled}
          control={
            <Checkbox
              size="small"
              checked={grantsAll}
              onChange={() =>
                // Unticking "all" starts from every document selected, so access is unchanged until
                // the owner actually removes one.
                onChange(grantsAll ? documents.map((d) => d._id) : [])
              }
            />
          }
          label={
            <Typography variant={dense ? 'body2' : 'body1'}>
              All screenplays, including new ones
            </Typography>
          }
        />
        {!grantsAll &&
          documents.map((document) => {
            const checked = selectedIds.includes(document._id);
            return (
              <FormControlLabel
                key={document._id}
                disabled={disabled || (checked && selectedIds.length === 1)}
                sx={{ ml: 2 }}
                control={
                  <Checkbox
                    size="small"
                    checked={checked}
                    onChange={() => toggleDocument(document._id)}
                  />
                }
                label={
                  <Typography variant={dense ? 'body2' : 'body1'}>
                    {document.name}
                    {document.isPrimary ? ' (main)' : ''}
                  </Typography>
                }
              />
            );
          })}
      </FormGroup>
      {!grantsAll && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Screenplays added later will not be shared. Untick the Screenplay aspect to revoke access
          entirely.
        </Typography>
      )}
    </Box>
  );
}
