'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_QUERY } from '@/queries/ProjectQueries';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import type { Inspiration, Project } from '@/interfaces/project';
import '@/styles/screenplayWorkspace.css';

const endpoint = GRAPHQL_ENDPOINT;

export interface ScreenplayInspirationPanelProps {
  projectId: string;
}

function InspirationCardSkeleton() {
  return (
    <Paper elevation={1} className="screenplay-inspiration-panel__card" sx={{ p: 2 }}>
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="rectangular" height={120} sx={{ mt: 1, borderRadius: 1 }} />
    </Paper>
  );
}

/**
 * Read-only inspiration list for the Screenplay side panel.
 */
export function ScreenplayInspirationPanel({ projectId }: ScreenplayInspirationPanelProps) {
  const fetchProject = React.useCallback(async (): Promise<{ getProjectData: Project[] }> => {
    const { userProfile } = await useUserProfileStore.getState();
    const variables = { input: { user: userProfile?.user, _id: projectId } };
    return request(endpoint, PROJECT_QUERY, variables);
  }, [projectId]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: fetchProject,
    enabled: Boolean(projectId),
  });

  const inspiration = (data?.getProjectData?.[0] as Project | undefined)?.inspiration as
    | Inspiration[]
    | undefined;

  if (isLoading) {
    return (
      <Box className="screenplay-inspiration-panel" role="region" aria-label="Inspiration">
        <InspirationCardSkeleton />
        <InspirationCardSkeleton />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box
        className="screenplay-inspiration-panel screenplay-inspiration-panel__error"
        role="region"
        aria-label="Inspiration"
      >
        <Typography variant="caption" color="text.secondary">
          Could not load inspiration. Try again later.
        </Typography>
      </Box>
    );
  }

  if (!Array.isArray(inspiration) || inspiration.length === 0) {
    return (
      <Box
        className="screenplay-inspiration-panel screenplay-inspiration-panel__empty"
        role="region"
        aria-label="Inspiration"
      >
        <Typography variant="caption" color="text.disabled">
          No inspiration items yet.
          <br />
          Add items on the project Inspiration page.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="screenplay-inspiration-panel" role="region" aria-label="Inspiration">
      {inspiration.map((item) => (
        <Paper
          key={item._id ?? item.title}
          elevation={1}
          className="screenplay-inspiration-panel__card"
          sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}
        >
          {item.title ? (
            <Typography variant="subtitle2" fontWeight={600}>
              {item.title}
            </Typography>
          ) : null}
          {item.image ? (
            <Box sx={{ mt: 0.5 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.title ?? 'Inspiration'}
                style={{ width: '100%', borderRadius: 4, objectFit: 'cover' }}
              />
            </Box>
          ) : null}
          {item.video && !item.image ? (
            <Box sx={{ mt: 0.5, position: 'relative', aspectRatio: '16 / 9' }}>
              <iframe
                width="100%"
                height="100%"
                src={item.video}
                title={item.title ?? 'Video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                style={{ border: 0, borderRadius: 4 }}
              />
            </Box>
          ) : null}
          {item.note ? (
            <Typography variant="body2" color="text.secondary">
              {item.note}
            </Typography>
          ) : null}
          {item.links && item.links.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {item.links.map((link, idx) => (
                <Typography
                  key={`${item._id}-link-${idx}`}
                  variant="caption"
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
          ) : null}
        </Paper>
      ))}
    </Box>
  );
}
