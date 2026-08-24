'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useTheme } from '@mui/material/styles';
import { toTitleCase } from 'utils/stringFormatting';
import { multiLineTruncate } from 'styles';
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import { ShareProjectModal } from '@/components/ShareProjectModal/ShareProjectModal';
import { FloatingStatSurface } from './FloatingStatSurface';

export interface FloatingProjectInfoTileProps {
  title: string;
  author: string;
  genre: string;
  logline: string;
  projectTypeLabel?: string;
  /** Era the story is set in, e.g. "1970s" or "Near future". */
  timePeriod?: string;
  /** Comparable titles from the project's "similar projects" field. */
  similarProjects?: string[];
  projectId?: string;
  isLoading?: boolean;
  onEditClick?: () => void;
  onDelete?: () => void;
}

/** Prompts shown in place of empty fields, so the tile reads the same shape either way. */
const FIELD_PLACEHOLDERS = {
  logline: 'e.g., A washed-up boxer gets one last shot at the title',
  genre: 'e.g., Drama, Horror, Comedy, Fantasy, SciFi',
  type: 'e.g., Feature, Television, Short, Play, Musical',
  timePeriod: 'e.g., 1970s, Present day, Near future',
  similarProjects: 'e.g., Chinatown, Fargo, Michael Clayton',
} as const;

interface InfoFieldRowProps {
  label: string;
  value?: string | null;
  placeholder: string;
  /** Clamp the row to this many lines (used for the logline). */
  clampLines?: number;
}

/** One "Label: value" row that falls back to an italic placeholder when the field is empty. */
function InfoFieldRow({ label, value, placeholder, clampLines }: InfoFieldRowProps) {
  const text = (value ?? '').trim();
  const hasValue = text.length > 0;

  return (
    <Tooltip title={label === 'Logline' && value}>
       <Typography
      variant="body2"
      component="div"
      sx={{ lineHeight: 1.45, ...(clampLines ? multiLineTruncate(clampLines) : {}) }}
    >
      <Box component="span" sx={{ fontWeight: 600 }}>
        {label}:{' '}
      </Box>
      <Box
        component="span"
        sx={hasValue ? undefined : { fontStyle: 'italic', color: 'text.disabled' }}
      >
        {hasValue ? text : placeholder}
      </Box>
    </Typography>
    </Tooltip>
   
  );
}

export function FloatingProjectInfoTile({
  title,
  author,
  genre,
  logline,
  projectTypeLabel,
  timePeriod,
  similarProjects,
  projectId,
  isLoading = false,
  onEditClick,
  onDelete,
}: FloatingProjectInfoTileProps) {
  const theme = useTheme();
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [actionsAnchorEl, setActionsAnchorEl] = React.useState<HTMLElement | null>(null);
  const actionsMenuOpen = Boolean(actionsAnchorEl);
  const hasActions = Boolean(onEditClick || onDelete || projectId);

  if (isLoading) {
    return (
      <FloatingStatSurface variant="info" className="project-float-info-tile">
        <ProjectStat floatSurface compact>
          <Skeleton variant="text" width="90%" height={28} />
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="80%" />
        </ProjectStat>
      </FloatingStatSurface>
    );
  }

  return (
    <FloatingStatSurface variant="info" className="project-float-info-tile">
      <ProjectStat floatSurface compact>
        <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {hasActions ? (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 1,
                display: 'flex',
                gap: 0.25,
              }}
            >
              <IconButton
                aria-label="Project actions"
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActionsAnchorEl(e.currentTarget);
                }}
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  boxShadow: 1,
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={actionsAnchorEl}
                open={actionsMenuOpen}
                onClose={() => setActionsAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                onClick={(e) => e.stopPropagation()}
              >
                {projectId ? (
                  <MenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActionsAnchorEl(null);
                      setShareModalOpen(true);
                    }}
                  >
                    <ShareIcon fontSize="small" style={{ marginRight: 8 }} />
                    Share
                  </MenuItem>
                ) : null}
                {onEditClick ? (
                  <MenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActionsAnchorEl(null);
                      onEditClick();
                    }}
                  >
                    <EditIcon fontSize="small" style={{ marginRight: 8 }} />
                    Edit
                  </MenuItem>
                ) : null}
                {onDelete ? (
                  <MenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActionsAnchorEl(null);
                      onDelete();
                    }}
                  >
                    <DeleteIcon fontSize="small" style={{ marginRight: 8 }} />
                    Delete
                  </MenuItem>
                ) : null}
              </Menu>
            </Box>
          ) : null}

          <Box sx={{ flexShrink: 0, pr: hasActions ? 4 : 0 }}>
            <Tooltip title={title} enterDelay={300}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                {title}
              </Typography>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" display="block">
              by {toTitleCase(author)}
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: "space-evenly",
              gap: 3,
              '& .MuiTypography-root': { fontSize: '0.8rem' },
            }}
          >
            
               <InfoFieldRow
              label="Logline"
              value={logline}
              placeholder={FIELD_PLACEHOLDERS.logline}
              clampLines={3}
            />

           
            <InfoFieldRow label="Genre" value={genre} placeholder={FIELD_PLACEHOLDERS.genre} />
            <InfoFieldRow
              label="Type"
              value={projectTypeLabel}
              placeholder={FIELD_PLACEHOLDERS.type}
            />
            <InfoFieldRow
              label="Time period"
              value={timePeriod}
              placeholder={FIELD_PLACEHOLDERS.timePeriod}
            />
            <InfoFieldRow
              label="Similar projects"
              value={Array.isArray(similarProjects) ? similarProjects.join(', ') : ''}
              placeholder={FIELD_PLACEHOLDERS.similarProjects}
            />
          </Box>
        </Box>
      </ProjectStat>

      {projectId ? (
        <ShareProjectModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          projectId={projectId}
          projectTitle={title}
          collaborators={[]}
        />
      ) : null}
    </FloatingStatSurface>
  );
}
