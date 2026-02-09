'use client';

import * as React from 'react';
import { Box, Card, CardMedia, CardContent, Container, IconButton, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
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
  const user = useUserProfileStore((s) => s.user)

  const variables = React.useMemo(() => ({ userId: user?.uid }), [user]);
  const { data } = useQuery<OutlineFrameworksResponse>({
    queryKey: ['outline-frameworks', user?.uid],
    queryFn: () => request(ENDPOINT, OUTLINE_FRAMEWORKS_QUERY, variables) as Promise<OutlineFrameworksResponse>,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) =>
      request(ENDPOINT, UPDATE_OUTLINE_FRAMEWORK, { id, input }),
    onSuccess: () => {
      setEditFramework(null);
      queryClient.invalidateQueries({ queryKey: ['outline-frameworks', user?.uid] });
    },
  });

  const frameworks = data?.getOutlineFrameworks ?? [];

  const handleUpdateSubmit = (values: OutlineFrameworkFormValues) => {
    if (!editFramework) return;
    const input = {
      user: user?.uid,
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
        <Link
          href="/projects"
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <AppLogo />
        </Link>
      </Container>
      <Box sx={{ position: 'fixed', bottom: 16, left: 16, zIndex: 1200 }}>
        <SettingsPopover standalone />
      </Box>

      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Manage outlines
      </Typography>

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
            }}
          >
            <CardMedia
              component="img"
              height="140"
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
