'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { Box, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import MovieIcon from '@mui/icons-material/Movie';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import NotesIcon from '@mui/icons-material/Notes';
import { useSpatialHoverLift } from '@/hooks/useSpatialHoverLift';
import { NoteCardStatusControl } from './NoteCardStatusControl';
import { getNoteStatus, NOTE_STATUS_COLORS, NOTE_STATUS_LABELS, type NoteStatus } from './status';
import type { AssociationTarget, Note, NoteAssociationKind } from './types';

interface NoteCardProps {
  note: Note;
  /** Notes page grid: fixed tile sized by the same CSS vars as character cards. */
  gridTile?: boolean;
  /** Resolved link target; when present the association chip opens its floating card. */
  associationTarget?: AssociationTarget;
  onEditClick?: (note: Note) => void;
  onDeleteClick?: (note: Note) => void;
  /** Moves the note between the To incorporate / Maybe / Incorporated buckets. */
  onStatusChange?: (note: Note, status: NoteStatus) => void;
  /** Opens the association's floating reference card, anchored at the click point. */
  onAssociationClick?: (target: AssociationTarget, anchor: { x: number; y: number }) => void;
}

const ASSOCIATION_ICONS: Record<NoteAssociationKind, React.ElementType> = {
  character: TheaterComedyIcon,
  scene: MovieIcon,
  inspiration: LightbulbOutlinedIcon,
  none: NotesIcon,
};

const ASSOCIATION_FALLBACK_LABELS: Record<NoteAssociationKind, string> = {
  character: 'Character',
  scene: 'Scene',
  inspiration: 'Inspiration',
  none: 'General note',
};

export function NoteCard({
  note,
  gridTile = false,
  associationTarget,
  onEditClick,
  onDeleteClick,
  onStatusChange,
  onAssociationClick,
}: NoteCardProps) {
  const { hoverHandlers, xrStyle } = useSpatialHoverLift(8, 24);

  const AssociationIcon = ASSOCIATION_ICONS[note.association.kind];
  // Prefer the live target label — a character renamed since the note was written should
  // read under its current name — and fall back to the denormalized one.
  const associationLabel =
    associationTarget?.label ||
    note.association.label?.trim() ||
    ASSOCIATION_FALLBACK_LABELS[note.association.kind];

  const canOpenAssociation = Boolean(
    associationTarget && associationTarget.paneKey.trim() && onAssociationClick
  );
  const status = getNoteStatus(note);

  return (
    <Card
      enable-xr=""
      className={gridTile ? 'note-card--grid' : undefined}
      {...hoverHandlers}
      style={xrStyle}
      sx={{
        ...(gridTile
          ? {
              width: 'var(--note-card-width, 480px)',
              minWidth: 0,
              maxWidth: 'var(--note-card-width, 480px)',
              height: 'var(--character-card-height, 390px)',
              maxHeight: 'var(--character-card-height, 390px)',
              flex: '0 0 auto',
            }
          : {
              width: 'var(--note-card-width, 480px)',
              maxWidth: '100%',
              height: 'var(--character-card-height, 390px)',
              maxHeight: 'var(--character-card-height, 390px)',
            }),
        borderRadius: 'var(--project-float-radius, 12px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <CardHeader
        sx={{ pb: 0.5, flexShrink: 0, '& .MuiCardHeader-content': { minWidth: 0 } }}
        title={note.title?.trim() || 'Untitled note'}
        titleTypographyProps={{
          fontWeight: 600,
          variant: 'subtitle1',
          // Long titles wrap onto a second line instead of being clipped.
          sx: { whiteSpace: 'normal', overflowWrap: 'anywhere' },
        }}
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {note.category.trim() && (
              <Chip size="small" label={note.category.trim()} variant="outlined" />
            )}
            <Chip
              size="small"
              label={NOTE_STATUS_LABELS[status]}
              color={NOTE_STATUS_COLORS[status]}
              variant="filled"
            />
          </Box>
        }
        action={
          <Box sx={{ display: 'flex' }}>
            <Tooltip title="Edit note">
              <IconButton size="small" onClick={() => onEditClick?.(note)} aria-label="Edit note">
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete note">
              <IconButton size="small" onClick={() => onDeleteClick?.(note)} aria-label="Delete note">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      <CardContent
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          pt: 1,
          '&:last-child': { pb: 1 },
        }}
      >
        <Typography
          variant="body2"
          color="text.disabled"
          // Note bodies are user HTML: wrap long words/URLs and keep media inside the card.
          sx={{
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            '& img, & table, & pre': { maxWidth: '100%' },
            '& pre': { whiteSpace: 'pre-wrap' },
          }}
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
      </CardContent>

      <CardActions
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: 'divider',
          gap: 0.5,
          justifyContent: 'space-between',
          px: 1,
          py: 0.5,
        }}
      >
        <Tooltip title={canOpenAssociation ? `Open ${associationLabel}` : associationLabel}>
          <Chip
            size="small"
            variant="outlined"
            icon={<AssociationIcon fontSize="small" />}
            label={associationLabel}
            clickable={canOpenAssociation}
            onClick={
              canOpenAssociation
                ? (e) => onAssociationClick?.(associationTarget!, { x: e.clientX, y: e.clientY })
                : undefined
            }
            sx={{
              maxWidth: '55%',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        </Tooltip>
        <NoteCardStatusControl status={status} onChange={(next) => onStatusChange?.(note, next)} />
      </CardActions>
    </Card>
  );
}
