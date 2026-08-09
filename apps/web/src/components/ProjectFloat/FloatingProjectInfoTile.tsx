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
import { ProjectMetadataRows } from '@/components/ProjectCard/ProjectCard';
import { ShareProjectModal } from '@/components/ShareProjectModal/ShareProjectModal';
import { FloatingStatSurface } from './FloatingStatSurface';

export interface FloatingProjectInfoTileProps {
  title: string;
  author: string;
  genre: string;
  logline: string;
  projectTypeLabel?: string;
  projectId?: string;
  isLoading?: boolean;
  onEditClick?: () => void;
  onDelete?: () => void;
}

export function FloatingProjectInfoTile({
  title,
  author,
  genre,
  logline,
  projectTypeLabel,
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

          <Typography variant="caption" component="div" sx={{ ...multiLineTruncate(3), flexShrink: 0 }}>
            {logline}
          </Typography>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', '& .MuiTypography-root': { fontSize: '0.75rem' } }}>
            <ProjectMetadataRows
              genre={genre}
              projectTypeLabel={projectTypeLabel}
              hideBudgetAndSimilarProjects
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
