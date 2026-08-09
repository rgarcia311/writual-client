'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import GroupsIcon from '@mui/icons-material/Groups';

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
  const rowGap = compact ? 0.35 : 1;
  const avatarSize = compact ? 28 : 40;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', flex: 1, gap: rowGap, minWidth: 0, minHeight: 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: compact ? '0.8rem' : undefined }}>
          Character Scene Count
        </Typography>
        <GroupsIcon sx={{ fontSize: compact ? 18 : 22, color: 'text.secondary' }} aria-hidden />
      </Box>

      {topCharacters.length === 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontStyle: 'italic', fontSize: compact ? '0.65rem' : undefined }}
        >
          {emptyMessage}
        </Typography>
      ) : (
        <>
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: 'text.primary', fontSize: compact ? '0.68rem' : undefined }}
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
              gap: compact ? 0.35 : 1,
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
                <Typography variant="body2" sx={{ minWidth: 0, fontSize: compact ? '0.72rem' : undefined }}>
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
            sx={{ fontWeight: 700, mt: 'auto', pt: compact ? 0.25 : 0.5, fontSize: compact ? '0.68rem' : undefined }}
          >
            Total Characters: {totalCharacters}
          </Typography>
        </>
      )}
    </Box>
  );
}
