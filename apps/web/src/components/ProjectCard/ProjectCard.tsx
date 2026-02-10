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
  coverImage,
  maxWidth,
  maxHeight,
  enableCardShadow = true,
  onDelete,
  projectId,
  sharedWith: sharedWithProp = [],
  to,
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

  const defaultImage =
    typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
      ? '/dev_image.png'
      : 'https://m.media-amazon.com/images/I/513WUcomv-L._AC_UF1000,1000_QL80_.jpg';
  const imageSrc = coverImage?.trim() ? coverImage : defaultImage;

  return (
    <Card
      role={to ? 'button' : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={to ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(to); } } : undefined}
      onClick={handleCardClick}
      elevation={enableCardShadow ? 1 : 0}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        borderRadius: 2,
        boxShadow: enableCardShadow ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        overflow: 'hidden',
        ...(to ? { cursor: 'pointer', '&:hover': { boxShadow: 3 }, transition: 'box-shadow 0.2s ease' } : {}),
      }}
    >
      <CardMedia
        component="img"
        sx={{ border: '1px solid red', p: {padding}, marginRight: enableCardShadow ? 0 : '8px', width: 185, height: 'max-content', objectFit: 'cover', borderRadius: 4  }}
        image={imageSrc}
        alt={`${title} cover`}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <CardContent sx={{ flex: '1 0 auto', pt: 2, p: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            by {toTitleCase(author)}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 3, // Set the maximum number of lines here
        WebkitBoxOrient: 'vertical', }}>
            {logline}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Genre: {genre}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 500 }}>
            Development Progress:
          </Typography>
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
        </CardContent>
        <CardActions sx={{ width: "100%", display: 'flex', justifyContent: 'space-between', px: 1.5, pb: 1, pt: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {projectId ? (
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
                        Not shared with anyone yet.
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
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'flex-start' }}>
                      <TextField
                        size="small"
                        placeholder="Add email"
                        value={newEmail}
                        onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), doAddShareEmail())}
                        error={Boolean(emailError)}
                        helperText={emailError}
                        fullWidth
                      />
                      <Button variant="contained" size="small" onClick={handleAddShareEmail}>
                        Add
                      </Button>
                    </Box>
                  </Box>
                </Popover>
              </>
            ) : null}
          </Box>
          {onDelete ? (
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
