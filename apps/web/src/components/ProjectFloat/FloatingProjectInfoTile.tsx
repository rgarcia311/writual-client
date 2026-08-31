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
import { ProjectStat } from '@/components/ProjectCard/ProjectStat';
import {
  TILE_LABEL_SIZE,
  TILE_MIN_SIZE,
  TILE_VALUE_SIZE,
  tileRowGap,
} from '@/components/ProjectCard/stats/statTileParts';
import { ShareProjectModal } from '@/components/ShareProjectModal/ShareProjectModal';
import { FloatingStatSurface } from './FloatingStatSurface';

export interface FloatingProjectInfoTileProps {
  title: string;
  author: string;
  genre: string;
  projectTypeLabel?: string;
  /** Production budget, raw number (e.g. 1000000). */
  budget?: number;
  /** Outline framework the project follows, e.g. "Save the Cat". */
  outlineName?: string;
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
  genre: 'e.g., Drama, Horror, Comedy, Fantasy, SciFi',
  type: 'e.g., Feature, Television, Short, Play, Musical',
  timePeriod: 'e.g., 1970s, Present day, Near future',
  budget: 'e.g., $1,500,000',
  outlineName: 'e.g., Save the Cat, Hero\u2019s Journey',
  similarProjects: 'e.g., Chinatown, Fargo, Michael Clayton',
} as const;

/** Budget as currency; blank for an unset or zero budget so the placeholder shows instead. */
function formatBudget(budget?: number): string {
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(budget);
}

interface InfoFieldCellProps {
  label: string;
  value?: string | null;
  placeholder: string;
}

/**
 * One cell of the details grid: label over value, matching the Project Progress card's grid cells.
 * An empty field falls back to an italic placeholder so the grid keeps its shape either way.
 */
function InfoFieldCell({ label, value, placeholder }: InfoFieldCellProps) {
  const text = (value ?? '').trim();
  const hasValue = text.length > 0;

  return (
    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.15 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, fontSize: TILE_LABEL_SIZE, lineHeight: 1.25 }}
      >
        {label}
      </Typography>
      <Tooltip title={hasValue ? text : ''} enterDelay={300}>
        <Typography
          variant="caption"
          component="div"
          sx={{
            fontWeight: 600,
            fontSize: TILE_VALUE_SIZE,
            lineHeight: 1.3,
            minWidth: 0,
            ...(hasValue ? undefined : { fontStyle: 'italic', color: 'text.disabled' }),
          }}
        >
          {hasValue ? text : placeholder}
        </Typography>
      </Tooltip>
    </Box>
  );
}

export function FloatingProjectInfoTile({
  title,
  author,
  genre,
  projectTypeLabel,
  budget,
  outlineName,
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
        <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
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
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ fontSize: TILE_MIN_SIZE }}
            >
              by {toTitleCase(author)}
            </Typography>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              mt: '5px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              alignContent: 'space-between',
              columnGap: 1,
              rowGap: tileRowGap(true),
            }}
          >
            <InfoFieldCell label="Genre" value={genre} placeholder={FIELD_PLACEHOLDERS.genre} />
            <InfoFieldCell
              label="Type"
              value={projectTypeLabel}
              placeholder={FIELD_PLACEHOLDERS.type}
            />
            <InfoFieldCell
              label="Time period"
              value={timePeriod}
              placeholder={FIELD_PLACEHOLDERS.timePeriod}
            />
            <InfoFieldCell
              label="Budget"
              value={formatBudget(budget)}
              placeholder={FIELD_PLACEHOLDERS.budget}
            />
            <InfoFieldCell
              label="Outline"
              value={outlineName}
              placeholder={FIELD_PLACEHOLDERS.outlineName}
            />
            <InfoFieldCell
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
