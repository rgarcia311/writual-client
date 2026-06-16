'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { ScratchPadCardProps, MoveToDestination } from './types';

const TYPE_LABELS: Record<string, string> = {
  note: 'Note',
  link: 'Link',
  image: 'Image',
  video: 'Video',
};

const MOVE_OPTIONS: { value: MoveToDestination; label: string }[] = [
  { value: 'characters', label: 'Character' },
  { value: 'outline', label: 'Outline' },
  { value: 'chat', label: 'Chat' },
];

export function ScratchPadCard({ data, onMoveTo }: ScratchPadCardProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);
  const handleMove = (destination: MoveToDestination) => {
    onMoveTo?.(destination);
    handleMenuClose();
  };

  const typeLabel = TYPE_LABELS[data.type] ?? data.type;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, pt: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {typeLabel}:
        </Typography>
        <IconButton size="small" onClick={handleMenuOpen} aria-label="Move content" aria-haspopup="true" aria-expanded={open ? 'true' : undefined}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: 'text.secondary' }}>
          Move to
        </Typography>
        {MOVE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} onClick={() => handleMove(opt.value)}>
            {opt.label}
          </MenuItem>
        ))}
      </Menu>

      <CardContent sx={{ flex: 1, pt: 0, pb: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {data.type === 'note' && (
          <Typography variant="body2" color="text.primary" sx={{ overflow: 'auto', flex: 1 }}>
            {data.text || '—'}
          </Typography>
        )}
        {data.type === 'link' && (
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            <Link href={data.url} target="_blank" rel="noopener noreferrer" variant="body2" underline="hover" sx={{ wordBreak: 'break-all' }}>
              {data.label || data.url || '—'}
            </Link>
            {data.label && data.url && data.url !== data.label && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {data.url}
              </Typography>
            )}
          </Box>
        )}
        {data.type === 'image' && (
          <Box sx={{ flex: 1, minHeight: 80, display: 'flex', flexDirection: 'column' }}>
            {data.src ? (
              <CardMedia
                component="img"
                image={data.src}
                alt={data.caption || 'Image'}
                sx={{ objectFit: 'cover', borderRadius: 1, maxHeight: 120, flex: 1 }}
              />
            ) : (
              <Box sx={{ flex: 1, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                <Typography variant="caption" color="text.secondary">No image</Typography>
              </Box>
            )}
            {data.caption && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{data.caption}</Typography>
            )}
          </Box>
        )}
        {data.type === 'video' && (
          <Box sx={{ flex: 1, minHeight: 80, display: 'flex', flexDirection: 'column' }}>
            {data.src ? (
              <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', flex: 1, minHeight: 80 }}>
                <CardMedia component="img" image={data.src} alt={data.caption || 'Video'} sx={{ objectFit: 'cover', width: '100%', maxHeight: 120 }} />
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.3)' }}>
                  <PlayArrowIcon sx={{ fontSize: 48, color: 'common.white' }} />
                </Box>
              </Box>
            ) : (
              <Box sx={{ flex: 1, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                <PlayArrowIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
              </Box>
            )}
            {data.caption && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{data.caption}</Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
