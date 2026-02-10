'use client';

import * as React from 'react';
import { Box, Card, CardMedia, CardContent, Container, IconButton, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { OUTLINE_FRAMEWORKS_QUERY } from '@/queries/OutlineQueries';
import { UPDATE_OUTLINE_FRAMEWORK } from 'mutations/OutlineMutations';
import { OutlineFrameworkForm, type OutlineFrameworkFormValues } from '@/components/OutlineFrameworkForm';
import Link from 'next/link';
import { SettingsPopover } from '@/components/SettingsPopover';
import { AppLogo } from '@/components/AppLogo';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { deleteOutlineFrameworkById } from '../actions/outlineFrameworks';

const ENDPOINT = GRAPHQL_ENDPOINT;

interface OutlineFrameworksResponse {
  getOutlineFrameworks?: any[];
}

export default function OutlinesPage() {
  const queryClient = useQueryClient();
  const [editFramework, setEditFramework] = React.useState<{
    id: string;
    name: string;
    imageUrl?: string;
    format?: {
      name?: string;
      steps?: Array<{ step_id?: string; name?: string; number?: number; act?: string; instructions?: string }>;
    };
  } | null>(null);
  const userProfile = useUserProfileStore(s => s.userProfile)

  const variables = React.useMemo(() => ({ user: userProfile?.user }), [userProfile]);
  const { data } = useQuery<OutlineFrameworksResponse>({
    queryKey: ['outline-frameworks', userProfile?.user],
    queryFn: () => request(ENDPOINT, OUTLINE_FRAMEWORKS_QUERY, variables) as Promise<OutlineFrameworksResponse>,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) =>
      request(ENDPOINT, UPDATE_OUTLINE_FRAMEWORK, { id, input }),
    onSuccess: () => {
      setEditFramework(null);
      queryClient.invalidateQueries({ queryKey: ['outline-frameworks', userProfile?.user] });
    },
  });

  const frameworks = data?.getOutlineFrameworks ?? [];

  const handleDeleteFramework = async (fw: any) => {
    const id = fw?._id ?? fw?.id;
    if (!id) return;
    const ok = window.confirm(`Delete "${fw?.name ?? 'this'}" outline framework?`);
    if (!ok) return;
    try {
      await deleteOutlineFrameworkById(String(id));
      if (editFramework?.id === fw?.id) setEditFramework(null);
      queryClient.invalidateQueries({ queryKey: ['outline-frameworks', userProfile?.user] });
    } catch (e) {
      console.error('Failed to delete outline framework:', e);
      window.alert('Failed to delete outline framework. Please try again.');
    }
  };

  const handleUpdateSubmit = (values: OutlineFrameworkFormValues) => {
    if (!editFramework) return;
    const input = {
      user: userProfile?.user,
      name: values.formatName.trim(),
      imageUrl: values.imageUrl.trim() || undefined,
      format: {
        name: values.formatName.trim(),
        steps: values.steps.map((s) => ({
          name: s.name,
          number: s.number,
          act: s.act,
          instructions: s.instructions,
        })),
      },
    };
    updateMutation.mutate({ id: editFramework.id, input });
  };

  return (
    <Container maxWidth={false} disableGutters sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%', p: 2 }}>
      <Container
        disableGutters
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          height: 70,
          marginTop: '10px',
          textAlign: 'center',
        }}
      >
      <Typography fontFamily={'Merriweather'} letterSpacing={5} fontSize={28} fontWeight={700} color="primary">Outlines</Typography>

      </Container>
    


      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {frameworks.map((fw: any) => (
          <Card
            key={fw.id}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              maxWidth: 280,
              position: 'relative',
            }}
          >
            <IconButton
              size="small"
              onClick={() => handleDeleteFramework(fw)}
              aria-label="Delete framework"
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                zIndex: 2,
                bgcolor: 'rgba(0,0,0,0.35)',
                color: 'common.white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
            <CardMedia
              component="img"
              height="max-content"
              image={fw.imageUrl || '/logo_symbol.png'}
              alt={fw.name}
              sx={{ objectFit: 'cover' }}
            />
            <CardContent sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flex: 1 }}>
                {fw.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setEditFramework(fw)}
                aria-label="Edit framework"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </CardContent>
          </Card>
        ))}
      </Box>

      <OutlineFrameworkForm
        open={Boolean(editFramework)}
        onClose={() => setEditFramework(null)}
        onSubmit={handleUpdateSubmit}
        initialData={editFramework ?? undefined}
        submitLabel="Update framework"
        submitting={updateMutation.isPending}
      />
    </Container>
  );
}
