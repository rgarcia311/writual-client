'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import GroupsIcon from '@mui/icons-material/Groups';
import { StatTileStack, TileHeading, TILE_MIN_SIZE, tileIconSx, tileRowGap } from './statTileParts';

interface CharacterRankRow {
  name: string;
  sceneCount: number;
  imageUrl?: string | null;
}

interface CharacterSceneCountStatProps {
  topCharacters: CharacterRankRow[];
  totalCharacters: number;
  emptyMessage?: string;
  compact?: boolean;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');
  return p || '?';
}

export function CharacterSceneCountStat({
  topCharacters,
  totalCharacters,
  emptyMessage = 'Add characters and screenplay dialogue cues to populate this stat.',
  compact = false,
}: CharacterSceneCountStatProps) {
  const avatarSize = compact ? 28 : 40;

  return (
    <StatTileStack
      compact={compact}
      heading={
        <TileHeading
          title="Character Scene Count"
          compact={compact}
          icon={
            <GroupsIcon sx={tileIconSx(compact)} aria-hidden />
          }
        />
      }
    >
      {topCharacters.length === 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontStyle: 'italic', fontSize: TILE_MIN_SIZE }}
        >
          {emptyMessage}
        </Typography>
      ) : (
        <>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'text.primary', fontSize: TILE_MIN_SIZE }}
          >
            Top characters:
          </Typography>
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: tileRowGap(compact),
            }}
          >
            {topCharacters.map((row) => (
              <Box
                key={row.name}
                component="li"
                sx={{ display: 'flex', alignItems: 'center', gap: compact ? 0.5 : 1, minWidth: 0 }}
              >
                <Avatar
                  variant="rounded"
                  src={row.imageUrl?.trim() || undefined}
                  alt=""
                  sx={{ width: avatarSize, height: avatarSize, bgcolor: 'action.selected' }}
                  imgProps={{ loading: 'lazy' as const }}
                >
                  {initials(row.name)}
                </Avatar>
                <Typography variant="body2" sx={{ minWidth: 0, fontSize: TILE_MIN_SIZE }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {row.name}:
                  </Box>{' '}
                  <Box component="span" color="text.secondary">
                    {row.sceneCount} Scenes
                  </Box>
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, mt: 'auto', pt: compact ? 0.25 : 0.5, fontSize: TILE_MIN_SIZE }}
          >
            Total Characters: {totalCharacters}
          </Typography>
        </>
      )}
    </StatTileStack>
  );
}
