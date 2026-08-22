'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useTheme } from '@mui/material/styles';
import { toTitleCase } from 'utils/stringFormatting';
import { multiLineTruncate } from 'styles';
import { ShareProjectModal } from '@/components/ShareProjectModal/ShareProjectModal';
import type { Collaborator } from '@/interfaces/collaborator';
import type { WritingTracker } from '@/interfaces/project';
import { useSpatialHoverLift } from '@/hooks/useSpatialHoverLift';

interface ProgressItem {
  label: string;
  status: 'complete' | 'partial' | 'empty';
}

interface ProjectCardProps {
  title: string;
  author: string; 
  genre: string; 
  logline: string;
  /** Project type label, e.g. "Feature" */
  projectTypeLabel?: string;
  /** Production budget (raw number, e.g. 1000000) */
  budget?: number;
  /** List of similar project titles */
  similarProjects?: string[];
  padding?: number;
  coverImage?: string;
  progress?: ProgressItem[];
  maxWidth?: string | number;
  maxHeight?: string | number;
  enableCardShadow?: boolean;
  onDelete?: () => void;
  projectId?: string;
  collaborators?: Collaborator[];
  /** When set, clicking the card (not Share/Delete) navigates to this path */
  to?: string;
  /** @deprecated Accordion header removed; list layout is used everywhere. */
  headerOnly?: boolean;
  /** When set, show edit icon in top right and call this on click */
  onEditClick?: () => void;
  /** When true, hide budget and similar projects only. Used on projects list page. */
  hideBudgetAndSimilarProjects?: boolean;
  /** Writing tracker data for pace and schedule status display */
  writingTracker?: WritingTracker | null;
  /** When true, shows the development progress dots section */
  progressTrackingEnabled?: boolean;
  /** Called when user clicks "Add Progress Tracking" in the actions menu */
  onEnableProgressTracking?: () => void;
  /** Marks this card as the one the intro walkthrough points at when it asks for a click. */
  tourAnchor?: boolean;
}

interface ProjectMetadataRowsProps {
  genre: string;
  projectTypeLabel?: string;
  budget?: number;
  similarProjects?: string[];
  headerOnly?: boolean;
  hideBudgetAndSimilarProjects?: boolean;
}

export function ProjectMetadataRows({
  genre,
  projectTypeLabel,
  budget,
  similarProjects,
  headerOnly,
  hideBudgetAndSimilarProjects,
}: ProjectMetadataRowsProps) {
  console.log({ genre, projectTypeLabel, budget, similarProjects, headerOnly, hideBudgetAndSimilarProjects})
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-evenly"}}>
      <Typography variant="body1">
        Genre:{' '}
        {genre ? (
          genre
        ) : (
          <Typography component="span" variant="body1" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            e.g., Drama, Horror, Comedy, Fantasy, SciFi
          </Typography>
        )}
      </Typography>
      <Typography variant="body1">
        Type:{' '}
        {projectTypeLabel ? (
          projectTypeLabel
        ) : (
          <Typography component="span" variant="body1" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            e.g., Feature, Television, Short, Play, Musical
          </Typography>
        )}
      </Typography>
      {(headerOnly || hideBudgetAndSimilarProjects) && (
        <>
          <Typography variant="body1">
            Budget:{' '}
            {typeof budget === 'number' && budget > 0
              ? new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(budget)
              : '—'}
          </Typography>
          <Typography variant="body1">
            {headerOnly ? 'Similar Films/TV Shows:' : 'Similar projects:'}{' '}
            {
              similarProjects && similarProjects.length > 0
                ? similarProjects.join(', ')
                : '—'
            }
          </Typography>
        </>
      )}
    </Box>
  );
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  padding = '8px',
  title,
  author,
  genre,
  logline,
  projectTypeLabel,
  budget,
  similarProjects,
  coverImage,
  maxWidth,
  maxHeight,
  enableCardShadow = true,
  onDelete,
  projectId,
  collaborators = [],
  to,
  headerOnly = false,
  onEditClick,
  hideBudgetAndSimilarProjects = false,
  writingTracker,
  progressTrackingEnabled = false,
  onEnableProgressTracking,
  tourAnchor = false,
  progress = [
    { label: 'Title', status: 'complete' },
    { label: 'Logline', status: 'complete' },
    { label: 'Characters', status: 'complete' },
    { label: 'Outline', status: 'partial' },
    { label: 'Screenplay', status: 'complete' },
  ],
}) => {
  const router = useRouter();
  const theme = useTheme();
  const { hoverHandlers, xrStyle } = useSpatialHoverLift(8, 28);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [actionsAnchorEl, setActionsAnchorEl] = React.useState<HTMLElement | null>(null);
  const [imageError, setImageError] = React.useState(false);

  console.log({ similarProjects })

  React.useEffect(() => {
    setImageError(false);
  }, [coverImage]);

  const handleCardClick = (e: React.MouseEvent) => {
    if (!to) return;
    e.preventDefault();
    router.push(to);
  };

  const hasActions = Boolean(onEditClick || onDelete || projectId);
  const actionsMenuOpen = Boolean(actionsAnchorEl);

  const imageSrc = (coverImage?.trim() && !imageError) ? coverImage : '/default-film-poster.png';

  return (
    <Card
      enable-xr
      role={to && !headerOnly ? 'button' : undefined}
      tabIndex={to && !headerOnly ? 0 : undefined}
      onKeyDown={to && !headerOnly ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(to); } } : undefined}
      onClick={headerOnly ? undefined : handleCardClick}
      data-tour={tourAnchor ? 'project-card' : undefined}
      {...hoverHandlers}
      style={xrStyle}
      elevation={enableCardShadow ? 1 : 0}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        position: 'relative',
        width: maxWidth || 570,
        alignSelf: 'flex-start',
        borderRadius: 2,
        boxShadow: enableCardShadow ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        overflow: 'hidden',
        ...(to && !headerOnly ? { cursor: 'pointer', '&:hover': { boxShadow: 3 }, transition: 'box-shadow 0.2s ease' } : {}),
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1,
          display: 'flex',
          gap: 0.5,
          alignItems: 'center',
        }}
      >
        {hasActions && (
          <>
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
              {onEnableProgressTracking !== undefined && (
                <MenuItem
                  disabled={progressTrackingEnabled}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActionsAnchorEl(null);
                    onEnableProgressTracking();
                  }}
                >
                  <TrendingUpIcon fontSize="small" style={{ marginRight: 8 }} />
                  Add Progress Tracking
                </MenuItem>
              )}
              {projectId && (
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
              )}
              {onEditClick && (
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
              )}
              {onDelete && (
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
              )}
            </Menu>
          </>
        )}
        {projectId && (
          <ShareProjectModal
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            projectId={projectId}
            projectTitle={title}
            collaborators={collaborators}
          />
        )}
      </Box>
      <CardMedia
        component="img"
        sx={{
          alignSelf: 'flex-start',
          p: enableCardShadow ? 1 : 0,
          marginRight: enableCardShadow ? 0 : '8px',
          width: 185,
          aspectRatio: '2 / 3',
          objectFit: 'fill',
          borderRadius: 4,
          flexShrink: 0,
        }}
        image={imageSrc}
        alt={`${title} cover`}
        onError={() => setImageError(true)}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          alignSelf: 'stretch',
          py: 1.5,
          px: 1.5,
          ...(headerOnly && hasActions ? { pr: { xs: 1.5, sm: 8 } } : {}),
          justifyContent: 'space-evenly',
        }}
      >
        
          <Box sx={{ flexShrink: 0 }}>
            <Tooltip title={title} enterDelay={300}>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                {title.length > 23 ? `${title.slice(0, 23)}…` : title}
              </Typography>
            </Tooltip>
            <Typography variant="body2" color="text.secondary">
              by {toTitleCase(author)}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: 1,
            }}
          >
            <Tooltip title={logline}>
              <Typography variant="body1" sx={multiLineTruncate(3)}>
                {logline}
              </Typography>
            </Tooltip>
            
            
            <ProjectMetadataRows
              genre={genre}
              projectTypeLabel={projectTypeLabel}
              budget={budget}
              similarProjects={similarProjects}
              headerOnly={headerOnly}
              hideBudgetAndSimilarProjects={hideBudgetAndSimilarProjects}
            />
          </Box>
        
      </Box>
    </Card>
  );
};
