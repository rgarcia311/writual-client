'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';
import { PROJECT_QUERY } from '@/queries/ProjectQueries';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import type { Project } from '@/interfaces/project';
import { addInspiration, deleteInspiration } from '../../app/actions/inspirations';

const endpoint = GRAPHQL_ENDPOINT;

interface ProjectOverviewContentProps {
  projectId: string;
}

export function ProjectOverviewContent({ projectId }: ProjectOverviewContentProps) {
  const id = projectId;
  const queryClient = useQueryClient();
  const [inspirationFormOpen, setInspirationFormOpen] = useState(false);
  const [inspirationTitle, setInspirationTitle] = useState('');
  const [inspirationImage, setInspirationImage] = useState('');
  const [inspirationVideo, setInspirationVideo] = useState('');
  const [inspirationNote, setInspirationNote] = useState('');
  const [inspirationLinks, setInspirationLinks] = useState('');

  const fetchProject = async (): Promise<{ getProjectData: Project[] }> => {
    const { userProfile } = await useUserProfileStore.getState();
    const variables = { input: { user: userProfile?.user, _id: id } };
    return request(endpoint, PROJECT_QUERY, variables);
  };

  const { data } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(),
    enabled: Boolean(id),
  });

  const projectData = data?.getProjectData?.[0] as Project | undefined;

  return (
    <ProjectDetailsLayout>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Inspiration
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setInspirationFormOpen(true)}
        >
          Add Inspiration
        </Button>
      </Box>
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          height: '90%',
          paddingTop: 5,
          overflowY: 'scroll',
          overflowX: 'hidden',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          padding: 2,
          minWidth: 0,
        }}
      >
        {Array.isArray((projectData as any)?.inspiration) &&
          (projectData as any).inspiration.map((item: any) => (
            <Paper
              elevation={2}
              key={item._id}
              sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, position: 'relative' }}
            >
              <Typography variant="subtitle1" fontWeight={600}>
                {item.title}
              </Typography>
              {item.image && (
                <Box sx={{ mt: 1 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: '100%', borderRadius: 4, objectFit: 'cover' }}
                  />
                </Box>
              )}
              {item.video && !item.image && (
                <Box sx={{ mt: 1, position: 'relative' }}>
                  <iframe
                    width="100%"
                    height="100%"
                    src={item.video}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  />
                </Box>
              )}
              {item.note && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {item.note}
                </Typography>
              )}
              {item.links && item.links.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {item.links.map((link: string, idx: number) => (
                    <Typography
                      key={idx}
                      variant="body2"
                      component="a"
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                      {link}
                    </Typography>
                  ))}
                </Box>
              )}
              <IconButton
                size="small"
                aria-label="Delete inspiration"
                onClick={async () => {
                  if (!id || !item._id) return;
                  const ok = window.confirm('Delete this inspiration item?');
                  if (!ok) return;
                  await deleteInspiration(id as string, item._id as string);
                  await queryClient.invalidateQueries({ queryKey: ['project', id] });
                }}
                sx={{
                  position: 'absolute',
                  right: 8,
                  bottom: 8,
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
      </Box>
      <Dialog open={inspirationFormOpen} onClose={() => setInspirationFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Inspiration</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Title
            </Typography>
            <TextField
              placeholder="Add a title"
              value={inspirationTitle}
              onChange={(e) => setInspirationTitle(e.target.value)}
              fullWidth
              variant="outlined"
              required
            />
          </Box>
          <TextField
            label="Image URL"
            value={inspirationImage}
            onChange={(e) => setInspirationImage(e.target.value)}
            fullWidth
          />
          <TextField
            label="Video URL (use embed link)"
            value={inspirationVideo}
            onChange={(e) => setInspirationVideo(e.target.value)}
            fullWidth
          />
          <TextField
            label="Note"
            value={inspirationNote}
            onChange={(e) => setInspirationNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Links (comma separated)"
            value={inspirationLinks}
            onChange={(e) => setInspirationLinks(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInspirationFormOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!id || !inspirationTitle.trim()) return;
              const links =
                inspirationLinks
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean) ?? [];
              await addInspiration({
                projectId: id as string,
                title: inspirationTitle.trim(),
                image: inspirationImage.trim() || undefined,
                video: inspirationVideo.trim() || undefined,
                note: inspirationNote.trim() || undefined,
                links,
              });
              await queryClient.invalidateQueries({ queryKey: ['project', id] });
              setInspirationFormOpen(false);
              setInspirationTitle('');
              setInspirationImage('');
              setInspirationVideo('');
              setInspirationNote('');
              setInspirationLinks('');
            }}
            disabled={!inspirationTitle.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </ProjectDetailsLayout>
  );
}
