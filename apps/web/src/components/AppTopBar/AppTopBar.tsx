'use client';

import * as React from 'react';
import { Box, Button, Link as MuiLink } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { SettingsPopover } from '@/components/SettingsPopover';
import { AppLogo } from '../AppLogo';
import { OutlineFrameworkForm, type OutlineFrameworkFormValues } from '@/components/OutlineFrameworkForm';
import { CREATE_OUTLINE_FRAMEWORK } from 'mutations/OutlineMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';

const ENDPOINT = GRAPHQL_ENDPOINT;

export function AppTopBar() {
  const pathname = usePathname();
  const isOutlinesPage = pathname === '/outlines';
  const openCreateProjectModal = useCreateProjectModalStore((s) => s.openModal);
  const queryClient = useQueryClient();
  const [outlineFormOpen, setOutlineFormOpen] = React.useState(false);

  const createOutlineMutation = useMutation({
    mutationFn: async (variables: { input: any }) =>
      request(ENDPOINT, CREATE_OUTLINE_FRAMEWORK, variables),
    onSuccess: () => {
      setOutlineFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['outline-frameworks'] });
    },
  });

  const handleOutlineFormSubmit = async (values: OutlineFrameworkFormValues) => {
    const userProfileState = await useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;

    const input = {
      user,
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
    createOutlineMutation.mutate({ input });
  };

  const primaryButton = isOutlinesPage ? (
    <Button
      variant="contained"
      color="primary"
      startIcon={<AccountTreeIcon />}
      onClick={() => setOutlineFormOpen(true)}
    >
      Create Outline
    </Button>
  ) : (
    <Button
      variant="contained"
      color="primary"
      startIcon={<AddIcon />}
      onClick={openCreateProjectModal}
    >
      Create Project
    </Button>
  );

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          padding: 1.5,
          maxHeight: 50,
          position: 'sticky',
          top: 0,
          zIndex: 3,
          backgroundColor: 'background.default',
        }}
      >
        <MuiLink
          component={Link}
          href="/projects"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'inherit' }}
        >
          <AppLogo size={30} />
        </MuiLink>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {primaryButton}
          <SettingsPopover standalone />
        </Box>
      </Box>
      <OutlineFrameworkForm
        open={outlineFormOpen}
        onClose={() => setOutlineFormOpen(false)}
        onSubmit={handleOutlineFormSubmit}
        submitLabel="Create framework"
        submitting={createOutlineMutation.isPending}
      />
    </>
  );
}
