'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import { alpha, useTheme } from '@mui/material/styles';
import { StatTileStack, TileHeading, tileIconSx, tileRowGap } from './statTileParts';

interface SceneHeadingRow {
  heading: string;
}

interface SceneIntExtAltStatProps {
  totalScenes: number;
  intCount: number;
  extCount: number;
  scenesWithAlts: SceneHeadingRow[];
  emptyScreenplayMessage?: string;
  compact?: boolean;
}

export function SceneIntExtAltStat({
  totalScenes,
  intCount,
  extCount,
  scenesWithAlts,
  emptyScreenplayMessage = 'Screenplay stats appear when screenplay content is available.',
  compact = false,
}: SceneIntExtAltStatProps) {
  const theme = useTheme();
  const hasDoc = totalScenes > 0;
  const wInt = Math.max(intCount, 0);
  const wExt = Math.max(extCount, 0);
  const sum = wInt + wExt;
  const pctInt = sum <= 0 ? 50 : (wInt / sum) * 100;
  const pctExt = 100 - pctInt;

  const intColor = theme.palette.success.main;
  const extColor = theme.palette.warning.main;

  const altSlice = compact ? 4 : 12;
  const altRows = scenesWithAlts.slice(0, altSlice);
  return (
    <StatTileStack
      compact={compact}
      heading={
        <TileHeading
          title="Scene Stats"
          compact={compact}
          icon={
            <MovieFilterIcon sx={tileIconSx(compact)} aria-hidden />
          }
        />
      }
    >
      {!hasDoc ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontStyle: 'italic', fontSize: compact ? '0.65rem' : undefined }}
        >
          {emptyScreenplayMessage}
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? '0.68rem' : undefined }}>
            Total Scenes: {totalScenes}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: compact ? '0.68rem' : undefined }}>
            Slugline types:{' '}
            <Box component="span" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              INT. ({Math.round(wInt)}) / EXT. ({Math.round(wExt)})
            </Box>
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: tileRowGap(compact) }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: intColor, fontWeight: 700 }}>
                INT. ({Math.round(wInt)})
              </Typography>
              <Typography variant="caption" sx={{ color: extColor, fontWeight: 700 }}>
                EXT. ({Math.round(wExt)})
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                height: compact ? theme.spacing(2) : theme.spacing(2.5),
                borderRadius: 1,
                overflow: 'hidden',
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              }}
              aria-label="Interior versus exterior slugline ratio"
            >
              <Box
                sx={{
                  width: `${pctInt}%`,
                  bgcolor: intColor,
                  minWidth: wInt > 0 ? theme.spacing(0.75) : 0,
                  transition: 'width 0.3s ease',
                }}
              />
              <Box
                sx={{
                  width: `${pctExt}%`,
                  bgcolor: extColor,
                  minWidth: wExt > 0 ? theme.spacing(0.75) : 0,
                  transition: 'width 0.3s ease',
                }}
              />
            </Box>
          </Box>

          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: compact ? '0.68rem' : undefined }}>
            Scenes with alts
          </Typography>
          {scenesWithAlts.length === 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontStyle: 'italic', fontSize: compact ? '0.65rem' : undefined }}
            >
              No scenes contain block alternatives yet.
            </Typography>
          ) : (
            <Box
              component="ul"
              className="scene-alts-list"
              sx={{
                listStyle: 'disc',
                m: 0,
                pl: 2,
                mb: 0,
                // Capped here for the project-card grid; inside a floating stat card the card's own
                // scroller takes over instead (see `projectDetailsFloat.css`).
                maxHeight: compact ? theme.spacing(5) : 'none',
                overflowY: compact ? 'auto' : 'visible',
                '& li': {
                  typography: 'caption',
                  color: 'text.secondary',
                  pl: 0.25,
                },
              }}
            >
          {altRows.map((s, i) => (
            <Box key={`${s.heading}-${i}`} component="li" sx={{ typography: 'caption', color: 'text.secondary', pl: 0.25 }}>
              {s.heading.length > 64 ? `${s.heading.slice(0, 64)}…` : s.heading}
            </Box>
          ))}
            </Box>
          )}
          {scenesWithAlts.length > altSlice && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: compact ? '0.62rem' : undefined }}>
              +{scenesWithAlts.length - altSlice} more
            </Typography>
          )}
        </>
      )}
    </StatTileStack>
  );
}
