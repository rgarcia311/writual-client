'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddCommentIcon from '@mui/icons-material/AddComment';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { LoglineVersion } from '@/interfaces/logline';
import type { ProjectAccess } from '../../utils/projectPermissions';
import { LoglineComposer } from './LoglineComposer';
import { MAX_FEEDBACK_LENGTH, MAX_LOGLINE_LENGTH, formatEntryDate, type LoglineHistoryHandlers } from './types';

export interface LoglineVersionRowProps extends Omit<LoglineHistoryHandlers, 'onAddVersion'> {
  version: LoglineVersion;
  access: ProjectAccess;
  viewerUid: string | null;
  isPending: boolean;
  dense: boolean;
}

/**
 * One logline iteration: its text, who wrote it and when, the feedback thread shared users have
 * left on it, and — for editors — edit / make-current / delete actions.
 */
export function LoglineVersionRow({
  version,
  access,
  viewerUid,
  isPending,
  dense,
  onUpdateVersion,
  onDeleteVersion,
  onMakeCurrent,
  onAddFeedback,
  onDeleteFeedback,
}: LoglineVersionRowProps) {
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isCommenting, setIsCommenting] = React.useState(false);

  const byline = [version.authorName || 'Unknown', formatEntryDate(version.createdAt)]
    .filter(Boolean)
    .join(' · ');

  const closeMenu = () => setMenuAnchor(null);

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? 0.4 : 0.75,
        p: dense ? 0.75 : 1.25,
        minWidth: 0,
        borderRadius: 1,
        border: '1px solid',
        borderColor: version.current ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <LoglineComposer
              initialValue={version.text}
              placeholder="Revise this logline"
              submitLabel="Save"
              maxLength={MAX_LOGLINE_LENGTH}
              dense={dense}
              autoFocus
              isPending={isPending}
              onCancel={() => setIsEditing(false)}
              onSubmit={(text) => {
                onUpdateVersion(version._id, text);
                setIsEditing(false);
              }}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontSize: dense ? '0.78rem' : '0.9rem',
                lineHeight: 1.45,
                // The whole logline stays visible — it wraps rather than truncating.
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {version.text}
            </Typography>
          )}
        </Box>

        {access.canEdit && !isEditing ? (
          <>
            <IconButton
              size="small"
              aria-label="Logline version actions"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ flexShrink: 0, p: 0.25 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
              <MenuItem
                dense
                onClick={() => {
                  closeMenu();
                  setIsEditing(true);
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                  <EditIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Edit" />
              </MenuItem>
              <MenuItem
                dense
                disabled={version.current}
                onClick={() => {
                  closeMenu();
                  onMakeCurrent(version._id);
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                  <CheckCircleOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Make current" />
              </MenuItem>
              <MenuItem
                dense
                onClick={() => {
                  closeMenu();
                  onDeleteVersion(version._id);
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: 1 }}>
                  <DeleteOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Delete" />
              </MenuItem>
            </Menu>
          </>
        ) : null}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', minWidth: 0 }}>
        {version.current ? (
          <Chip
            label="Current"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.6rem' } }}
          />
        ) : null}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', minWidth: 0 }}>
          {byline}
        </Typography>
        {access.canComment ? (
          <Tooltip title={isCommenting ? 'Cancel feedback' : 'Add feedback'}>
            <IconButton
              size="small"
              aria-label={isCommenting ? 'Cancel feedback' : 'Add feedback'}
              onClick={() => setIsCommenting((open) => !open)}
              sx={{ ml: 'auto', p: 0.25 }}
            >
              {isCommenting ? <CloseIcon fontSize="small" /> : <AddCommentIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      {version.feedback.length > 0 ? (
        <Box
          component="ul"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.4 }}
        >
          {version.feedback.map((note) => {
            const canDelete = access.isOwner || (viewerUid != null && note.authorUid === viewerUid);
            return (
              <Box
                key={note._id}
                component="li"
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 0.5,
                  minWidth: 0,
                  pl: 1,
                  borderLeft: '2px solid',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      fontSize: dense ? '0.7rem' : '0.8rem',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {note.text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                    {[note.authorName || 'Shared user', formatEntryDate(note.createdAt)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
                {canDelete ? (
                  <IconButton
                    size="small"
                    aria-label="Delete feedback"
                    onClick={() => onDeleteFeedback(version._id, note._id)}
                    sx={{ p: 0.25 }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                ) : null}
              </Box>
            );
          })}
        </Box>
      ) : null}

      {isCommenting && access.canComment ? (
        <LoglineComposer
          placeholder="Leave feedback on this logline"
          submitLabel="Post"
          maxLength={MAX_FEEDBACK_LENGTH}
          dense
          autoFocus
          isPending={isPending}
          onCancel={() => setIsCommenting(false)}
          onSubmit={(text) => {
            onAddFeedback(version._id, text);
            setIsCommenting(false);
          }}
        />
      ) : null}
    </Box>
  );
}
