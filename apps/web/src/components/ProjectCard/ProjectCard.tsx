'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { UPDATE_PROJECT_SHARED_WITH } from 'mutations/ProjectMutations';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { toTitleCase } from 'utils/stringFormatting';

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
    console.log('to: ', to)
    if (!to) return;
    // Only navigate if the click wasn't on a button/link (they use stopPropagation)
    const target = e.target as HTMLElement;
    console.log('target: ', target.closest)
   
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
        minHeight: headerOnly ? undefined : 280,
        borderRadius: 2,
        boxShadow: enableCardShadow ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        overflow: 'hidden',
        ...(to && !headerOnly ? { cursor: 'pointer', '&:hover': { boxShadow: 3 }, transition: 'box-shadow 0.2s ease' } : {}),
      }}
    >
      {onEditClick && (
        <IconButton
          aria-label="Edit project"
          size="small"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditClick(); }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            backgroundColor: theme.palette.background.paper,
            boxShadow: 1,
            '&:hover': { backgroundColor: theme.palette.action.hover },
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}
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
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
        <CardContent sx={{ flex: 1, minHeight: 0, pt: 2, p: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {headerOnly ? (
            <>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                by {toTitleCase(author)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {logline}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Genre: {genre || '—'}
              </Typography>
          
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Type: {projectTypeLabel || '—'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Budget:{' '}
                {typeof budget === 'number' && budget > 0
                  ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(budget)
                  : '—'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Similar Films/TV Shows::{' '}
                {Array.isArray(similarProjects) && similarProjects.length > 0 ? similarProjects.join(', ') : '—'}
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                by {toTitleCase(author)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', }}>
                {logline}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Genre: {genre || '—'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Type: {projectTypeLabel || '—'}
              </Typography>
              {!hideBudgetAndSimilarProjects && (
                <>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Budget:{' '}
                    {typeof budget === 'number' && budget > 0
                      ? new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        }).format(budget)
                      : '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Similar projects:{' '}
                    {Array.isArray(similarProjects) && similarProjects.length > 0
                      ? similarProjects.join(', ')
                      : '—'}
                  </Typography>
                </>
              )}
              <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 500 }}>
                Development Progress:
              </Typography>
              {process.env.NODE_ENV === 'production' ? (
                <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                  Coming soon
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1, alignItems: 'center' }}>
                  {progress.map((item) => (
                    <Box key={item.label} sx={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.label}
                      </Typography>
                      <ProgressDot status={item.status} />
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </CardContent>
        <CardActions sx={{ flexShrink: 0, width: "100%", display: 'flex', justifyContent: 'space-between', px: 1.5, pb: 1, pt: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {projectId && !headerOnly ? (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareAnchorEl(e.currentTarget); }}
                  sx={{ minWidth: 'auto', py: 0.25, px: 1 }}
                  data-no-navigate
                >
                  Share Project
                </Button>
                <Popover
                  open={Boolean(shareAnchorEl)}
                  anchorEl={shareAnchorEl}
                  onClose={() => { setShareAnchorEl(null); setEmailError(''); setNewEmail(''); }}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
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
                              <IconButton
                                edge="end"
                                size="small"
                                aria-label={`Remove ${email}`}
                                onClick={(ev) => handleRemoveShareEmail(ev, email)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
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
            ) : null}
          </Box>
          {onDelete && !headerOnly ? (
            <IconButton
              aria-label="Delete project"
              size="small"
              data-no-navigate
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              sx={{
                backgroundColor: theme.palette.error.light,
                color: theme.palette.error.contrastText ?? theme.palette.common.white,
                '&:hover': {
                  backgroundColor: theme.palette.error.main,
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          ) : null}
        </CardActions>
      </Box>
    </Card>
  );
};
