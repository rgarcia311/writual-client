'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { LoglineHistoryPanel } from '@/components/LoglineHistory';
import type { LoglineHistoryViewProps } from '@/components/LoglineHistory';
import { TileHeading, TILE_META_SIZE } from './statTileParts';

export interface LoglineHistoryStatProps extends Omit<LoglineHistoryViewProps, 'dense'> {
  compact?: boolean;
  /** Opens the roomy dialog; omitted when the card is already shown at full size. */
  onExpand?: () => void;
}

/**
 * Presentational Logline History tile: heading, version count, and the shared panel. All data and
 * mutations come from `LoglineHistoryTile`.
 */
export function LoglineHistoryStat({ compact = false, onExpand, ...panelProps }: LoglineHistoryStatProps) {
  const { versions } = panelProps;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0.5, minWidth: 0, minHeight: 0 }}
    >
      <TileHeading
        title="Logline History"
        compact={compact}
        icon={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            {onExpand ? (
              <Tooltip title="Open logline history">
                <IconButton size="small" aria-label="Open logline history" onClick={onExpand} sx={{ p: 0.25 }}>
                  <OpenInFullIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : null}
            <HistoryEduIcon sx={{ fontSize: compact ? 18 : 22, color: 'text.secondary' }} aria-hidden />
          </Box>
        }
      />

      {versions.length > 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: TILE_META_SIZE }}>
          {versions.length} {versions.length === 1 ? 'version' : 'versions'}
        </Typography>
      ) : null}

      <LoglineHistoryPanel {...panelProps} dense={compact} />
    </Box>
  );
}
