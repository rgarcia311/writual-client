'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { UPDATE_PROJECT_SHARED_WITH } from 'mutations/ProjectMutations';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { toTitleCase } from 'utils/stringFormatting';
import { multiLineTruncate } from 'styles';

const endpoint = GRAPHQL_ENDPOINT;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

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
  sharedWith?: string[];
  /** When set, clicking the card (not Share/Delete) navigates to this path */
  to?: string;
  /** When true, show full project summary: image, title, author, genre, logline, type, budget, similar projects (and edit). Used in project header. */
  headerOnly?: boolean;
  /** When set, show edit icon in top right and call this on click */
  onEditClick?: () => void;
  /** When true, hide budget and similar projects only. Used on projects list page. */
  hideBudgetAndSimilarProjects?: boolean;
}

const getStatusColor = (status: 'complete' | 'partial' | 'empty') => {
  switch (status) {
    case 'complete':
      return '#4caf50';
    case 'partial':
      return 'transparent';
    case 'empty':
      return 'transparent';
    default:
      return 'transparent';
  }
};

const ProgressDot = ({ status }: { status: 'complete' | 'partial' | 'empty' }) => (
  <Box
    sx={{
      width: 12,
      height: 12,
      borderRadius: '50%',
      backgroundColor: getStatusColor(status),
      border: status !== 'complete' ? '2px solid #9e9e9e' : 'none',
      background:
        status === 'partial'
          ? 'linear-gradient(90deg, #4caf50 50%, transparent 50%)'
          : getStatusColor(status),
    }}
  />
);

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
  sharedWith: sharedWithProp = [],
  to,
  headerOnly = false,
  onEditClick,
  hideBudgetAndSimilarProjects = false,
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
  const queryClient = useQueryClient();
  const [shareAnchorEl, setShareAnchorEl] = React.useState<HTMLElement | null>(null);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [coverImage]);

  const handleCardClick = (e: React.MouseEvent) => {
    if (!to) return;
    e.preventDefault();
    router.push(to);
  };
  const [newEmail, setNewEmail] = React.useState('');
  const [emailError, setEmailError] = React.useState('');

  const sharedWith = Array.isArray(sharedWithProp) ? sharedWithProp : [];

  const updateSharedWithMutation = useMutation({
    mutationFn: (sharedWith: string[]) =>
      request(endpoint, UPDATE_PROJECT_SHARED_WITH, { projectId, sharedWith }),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });

  const doAddShareEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (sharedWith.includes(trimmed)) {
      setEmailError('Already shared with this email.');
      return;
    }
    setEmailError('');
    setNewEmail('');
    updateSharedWithMutation.mutate([...sharedWith, trimmed]);
  };

  const handleAddShareEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    doAddShareEmail();
  };

  const handleRemoveShareEmail = (e: React.MouseEvent, email: string) => {
    e.preventDefault();
    e.stopPropagation();
    updateSharedWithMutation.mutate(sharedWith.filter((e) => e !== email));
  };

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
        {onEditClick && (
          <Tooltip title="Edit Project">
            <IconButton
              aria-label="Edit project"
              size="small"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditClick(); }}
              sx={{
                backgroundColor: theme.palette.background.paper,
                boxShadow: 1,
                '&:hover': { backgroundColor: theme.palette.action.hover },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {projectId && (
          <>
            <Tooltip title="Share Project">
              <IconButton
                aria-label="Share project"
                size="small"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareAnchorEl(e.currentTarget); }}
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  boxShadow: 1,
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                }}
              >
                <ShareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Popover
              open={Boolean(shareAnchorEl)}
              anchorEl={shareAnchorEl}
              onClose={() => { setShareAnchorEl(null); setEmailError(''); setNewEmail(''); }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Box sx={{ p: 2, minWidth: 320, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Shared with
                </Typography>
                {sharedWith.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Not shared with anyone yet. (coming soon..)
                  </Typography>
                ) : (
                  <List dense sx={{ py: 0, maxHeight: 200, overflow: 'auto' }}>
                    {sharedWith.map((email) => (
                      <ListItem
                        key={email}
                        secondaryAction={
                          <Tooltip title="Remove from shared list">
                            <IconButton
                              edge="end"
                              size="small"
                              aria-label={`Remove ${email}`}
                              onClick={(ev) => handleRemoveShareEmail(ev, email)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemText primary={email} primaryTypographyProps={{ variant: 'body2' }} />
                      </ListItem>
                    ))}
                  </List>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'stretch' }}>
                  <TextField
                    size="small"
                    placeholder="Add email"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), doAddShareEmail())}
                    error={Boolean(emailError)}
                    helperText={emailError}
                    fullWidth
                    sx={{ '& .MuiInputBase-root': { height: 40 } }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    disabled
                    sx={{ minHeight: 40, height: 40 }}
                  >
                    Add
                  </Button>
                </Box>
              </Box>
            </Popover>
          </>
        )}
      </Box>
      <CardMedia
        component="img"
        sx={{
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
          minHeight: 0,
          alignSelf: 'stretch',
          py: 1.5,
          px: 1.5,
          justifyContent: 'space-between',
        }}
      >
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

        {/* Group 2: Content + Share + Delete - spaced evenly, matches media height */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-evenly',
            overflow: 'hidden',
          }}
        >
          <Typography variant="body2" sx={multiLineTruncate(3)}>
            {logline}
          </Typography>
          <Typography variant="body2">Genre: {genre || '—'}</Typography>
          <Typography variant="body2">Type: {projectTypeLabel || '—'}</Typography>
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
          <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Development Progress:
              </Typography>
              {process.env.NODE_ENV === 'production' ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Coming soon
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.5, alignItems: 'center' }}>
                  {progress.map((item) => (
                    <Box
                      key={item.label}
                      sx={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 0.5 }}
                    >
                      
                      <ProgressDot status={item.status} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            {onDelete && (
              <Tooltip title="Delete Project">
                <IconButton
                  aria-label="Delete project"
                  size="small"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }}
                  sx={{
                    backgroundColor: theme.palette.error.light,
                    color: theme.palette.error.contrastText ?? theme.palette.common.white,
                    '&:hover': { backgroundColor: theme.palette.error.main },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>
    </Card>
  );
};
