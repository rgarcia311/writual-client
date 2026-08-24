'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import {
  PERMISSION_SHORT_LABELS,
  type Collaborator,
  type PermissionLevel,
} from '@/interfaces/collaborator';
import type { SharableScreenplayDocument } from '@hooks/useProjectSharing';
import { summarizeAspects, summarizeScreenplayGrant } from './accessSummary';

/** What the viewer is looking at when the person is not a collaborator row. */
export type AccessRole = 'owner' | 'legacy-share';

const ROLE_LABELS: Record<AccessRole, string> = {
  owner: 'Owner',
  // Shares made before per-aspect collaborator rows existed; they carry full edit access.
  'legacy-share': 'Full access',
};

interface PermissionChipProps {
  level: PermissionLevel;
  /** Set instead of `level` for the owner or a legacy share, neither of which has one. */
  role?: AccessRole;
}

/** The one-word answer to "what can this person do here?" — for lists and headers. */
export function PermissionChip({ level, role }: PermissionChipProps) {
  const isElevated = role != null || level === 'edit';
  return (
    <Chip
      size="small"
      label={role ? ROLE_LABELS[role] : PERMISSION_SHORT_LABELS[level]}
      sx={{
        height: 18,
        fontSize: 10,
        fontWeight: 600,
        bgcolor: isElevated ? '#E8F5E9' : '#EEEEEE',
        color: isElevated ? '#1B5E20' : '#424242',
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

interface SummaryProps {
  collaborator: Collaborator;
  screenplayDocuments: SharableScreenplayDocument[];
  /** Show the pending/active invite chip alongside the permission chip. */
  showStatus?: boolean;
}

/** Permission level, invite status, and exactly which parts of the project were shared. */
export function CollaboratorAccessSummary({
  collaborator,
  screenplayDocuments,
  showStatus = false,
}: SummaryProps) {
  const screenplayGrant = summarizeScreenplayGrant(collaborator, screenplayDocuments);

  // Screenplay access is spelled out separately when it is narrower than the whole aspect, so the
  // aspect list drops it rather than saying "Screenplay · Draft 2".
  const aspects = screenplayGrant
    ? collaborator.aspects.filter((aspect) => aspect !== 'screenplay')
    : collaborator.aspects;

  const detail = [
    aspects.length > 0 ? summarizeAspects(aspects) : null,
    screenplayGrant,
  ].filter(Boolean).join(' · ');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.25 }}>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {showStatus && (
          <Chip
            label={collaborator.status === 'pending' ? 'Pending' : 'Active'}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              bgcolor: collaborator.status === 'pending' ? '#FFF3E0' : '#E8F5E9',
              color: collaborator.status === 'pending' ? '#E65100' : '#1B5E20',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
        <PermissionChip level={collaborator.permissionLevel} />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {detail || 'Nothing shared yet'}
      </Typography>
    </Box>
  );
}
