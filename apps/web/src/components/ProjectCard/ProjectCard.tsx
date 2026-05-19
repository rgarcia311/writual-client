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
import { computeWritingTrackerStatus } from '../../utils/progress';
import { deriveScreenplayPresenceStats } from '../../utils/projectScreenplayStats';
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages';
import { ProjectStat } from './ProjectStat';
import { ProjectStatsCarousel } from './ProjectStatsCarousel';
import { ScreenplayProgressStat } from './stats/ScreenplayProgressStat';
import { CharacterSceneCountStat } from './stats/CharacterSceneCountStat';
import { SceneIntExtAltStat } from './stats/SceneIntExtAltStat';
import { ProjectAtAGlanceStat } from './stats/ProjectAtAGlanceStat';

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
  /** When true, show full project summary: image, title, author, genre, logline, type, budget, similar projects (and edit). Used in project header. */
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
  /** Screenplay TipTap JSON (active version); used for character/scene-derived stats when present */
  screenplayJson?: unknown | null;
  /** Character roster (name / poster) paired with screenplay for scene counts */
  projectCharacters?: Array<{ name?: string | null; imageUrl?: string | null }> | null;
}

interface ProjectMetadataRowsProps {
  genre: string;
  projectTypeLabel?: string;
  budget?: number;
  similarProjects?: string[];
  headerOnly?: boolean;
  hideBudgetAndSimilarProjects?: boolean;
}

function ProjectMetadataRows({
  genre,
  projectTypeLabel,
  budget,
  similarProjects,
  headerOnly,
  hideBudgetAndSimilarProjects,
}: ProjectMetadataRowsProps) {
  return (
    <>
      <Typography variant="body2">
        Genre:{' '}
        {genre ? (
          genre
        ) : (
          <Typography component="span" variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            e.g., Drama, Horror, Comedy, Fantasy, SciFi
          </Typography>
        )}
      </Typography>
      <Typography variant="body2">
        Type:{' '}
        {projectTypeLabel ? (
          projectTypeLabel
        ) : (
          <Typography component="span" variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            e.g., Feature, Television, Short, Play, Musical
          </Typography>
        )}
      </Typography>
      {(headerOnly || !hideBudgetAndSimilarProjects) && (
        <>
          <Typography variant="body2">
            Budget:{' '}
            {typeof budget === 'number' && budget > 0
              ? new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(budget)
              : '—'}
          </Typography>
          <Typography variant="body2">
            {headerOnly ? 'Similar Films/TV Shows:' : 'Similar projects:'}{' '}
            {Array.isArray(similarProjects) && similarProjects.length > 0
              ? similarProjects.join(', ')
              : '—'}
          </Typography>
        </>
      )}
    </>
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
  screenplayJson = null,
  projectCharacters = null,
  progress = [
    { label: 'Title', status: 'complete' },
    { label: 'Logline', status: 'complete' },
    { label: 'Characters', status: 'complete' },
    { label: 'Treatment', status: 'partial' },
    { label: 'Outline', status: 'partial' },
    { label: 'Screenplay', status: 'complete' },
  ],
}) => {
  const router = useRouter();
  const theme = useTheme();
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [actionsAnchorEl, setActionsAnchorEl] = React.useState<HTMLElement | null>(null);
  const [imageError, setImageError] = React.useState(false);

  const liveBodyPages = useScreenplayLivePagesStore((s) =>
    projectId && s.projectId === projectId ? s.liveBodyPages : null,
  );

  const writingTrackerStatus = React.useMemo(
    () =>
      computeWritingTrackerStatus(writingTracker, {
        liveEditorBodyPages: liveBodyPages ?? undefined,
      }),
    [writingTracker, liveBodyPages],
  );

  const characterRoster = React.useMemo(
    () =>
      (projectCharacters ?? [])
        .map((c) => ({
          name: (c?.name ?? '').trim(),
          imageUrl: c?.imageUrl ?? null,
        }))
        .filter((c) => c.name.length > 0),
    [projectCharacters],
  );

  const screenplayPresence = React.useMemo(() => {
    if (screenplayJson == null) return null;
    try {
      return deriveScreenplayPresenceStats(
        screenplayJson,
        characterRoster.map((c) => c.name),
      );
    } catch {
      return null;
    }
  }, [screenplayJson, characterRoster]);

  const topCharactersByScenes = React.useMemo(() => {
    if (!screenplayPresence) return [];
    return [...screenplayPresence.characterSceneCounts]
      .sort((a, b) => b.sceneCount - a.sceneCount || a.display.localeCompare(b.display))
      .slice(0, 3)
      .map((row) => ({
        name: row.display,
        sceneCount: row.sceneCount,
        imageUrl:
          characterRoster.find((c) => c.name.toUpperCase() === row.normalized)?.imageUrl ??
          null,
      }));
  }, [screenplayPresence, characterRoster]);

  const trackingStatsGrid = (
    <ProjectStatsCarousel>
      <ProjectStat compact>
        {writingTracker?.enabled && writingTracker ? (
          <ScreenplayProgressStat
            compact
            tracker={writingTracker}
            status={writingTrackerStatus}
          />
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Enable writing tracking to view screenplay pacing, drafts, and deadlines.
          </Typography>
        )}
      </ProjectStat>
      <ProjectStat compact>
        <CharacterSceneCountStat compact topCharacters={topCharactersByScenes} totalCharacters={characterRoster.length} />
      </ProjectStat>
      <ProjectStat compact>
        <SceneIntExtAltStat
          compact
          totalScenes={screenplayPresence?.scenes.length ?? 0}
          intCount={screenplayPresence?.intSceneWeight ?? 0}
          extCount={screenplayPresence?.extSceneWeight ?? 0}
          scenesWithAlts={screenplayPresence?.scenesWithAlts ?? []}
        />
      </ProjectStat>
      <ProjectStat compact>
        <ProjectAtAGlanceStat
          compact
          progress={progress}
          trackerEnabled={Boolean(writingTracker?.enabled)}
          trackerStatus={writingTracker?.enabled ? writingTrackerStatus : null}
        />
      </ProjectStat>
    </ProjectStatsCarousel>
  );

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
      role={to && !headerOnly ? 'button' : undefined}
      tabIndex={to && !headerOnly ? 0 : undefined}
      onKeyDown={to && !headerOnly ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(to); } } : undefined}
      onClick={headerOnly ? undefined : handleCardClick}
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
          justifyContent: 'space-between',
        }}
      >
        {headerOnly && progressTrackingEnabled ? (
          <Box
            sx={{
              '--project-stats-height': '300px',
              flex: 1,
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              gap: 2,
              alignItems: 'stretch',
              minWidth: 0,
              minHeight: { xs: 'auto', lg: 'var(--project-stats-height)' },
            }}
          >
            <Box
              sx={{
                flex: { xs: '1 1 auto', lg: '0 1 auto' },
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                gap: 1,
              }}
            >
              <Box sx={{ flexShrink: 0, mb: '5px' }}>
                <Tooltip title={title} enterDelay={300}>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {title.length > 23 ? `${title.slice(0, 23)}…` : title}
                  </Typography>
                </Tooltip>
                <Typography variant="body2" color="text.secondary">
                  by {toTitleCase(author)}
                </Typography>
              </Box>
              <Typography variant="body2" sx={multiLineTruncate(3)}>
                {logline}
              </Typography>
              <ProjectMetadataRows
                genre={genre}
                projectTypeLabel={projectTypeLabel}
                budget={budget}
                similarProjects={similarProjects}
                headerOnly={headerOnly}
                hideBudgetAndSimilarProjects={hideBudgetAndSimilarProjects}
              />
            </Box>

            <Box
              sx={{
                flex: { xs: '1 1 auto', lg: '1 1 0%' },
                minWidth: 0,
                minHeight: 0,
                alignSelf: 'stretch',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {trackingStatsGrid}
            </Box>
          </Box>
        ) : (
          <>
            {/* Group 1: Title + Author */}
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

            {/* Group 2: metadata + optional development progress (flex fills space below title) */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={multiLineTruncate(3)}>
                {logline}
              </Typography>
              <ProjectMetadataRows
                genre={genre}
                projectTypeLabel={projectTypeLabel}
                budget={budget}
                similarProjects={similarProjects}
                headerOnly={headerOnly}
                hideBudgetAndSimilarProjects={hideBudgetAndSimilarProjects}
              />
            </Box>
          </>
        )}
      </Box>
    </Card>
  );
};
