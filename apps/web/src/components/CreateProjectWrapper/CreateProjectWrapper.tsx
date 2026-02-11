'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { request } from 'graphql-request';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { useOutlineFrameworksStore } from '@/state/outlineFrameworks';
import { CreateProject } from '@/components/CreateProject';
import { CREATE_PROJECT } from '@mutations/ProjectMutations';
import { OUTLINE_FRAMEWORKS_QUERY } from '@/queries/OutlineQueries';
import type { OutlineFrameworkItem } from '@/state/outlineFrameworks';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';

const endpoint = GRAPHQL_ENDPOINT;

interface OutlineFrameworksResponse {
  getOutlineFrameworks?: OutlineFrameworkItem[];
}

export function CreateProjectWrapper() {
  const open = useCreateProjectModalStore((s) => s.open);
  const setFrameworks = useOutlineFrameworksStore((s) => s.setFrameworks);
  const [user, setUser] = useState<string | undefined>();
  const [displayName, setDisplayName] = useState<string | undefined>();
  const [email, setEmail] = useState<string>('');
  const setOpen = useCreateProjectModalStore((s) => s.setOpen);
  const queryClient = useQueryClient();

  useEffect(() => {
    const userProfileState = useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user
    const displayName = userProfileState.userProfile?.displayName
    const email = userProfileState.userProfile?.email || ''
    setUser(user)
    setDisplayName(displayName || '')
    setEmail(email)
  }, []);

  const { data: outlineData } = useQuery<OutlineFrameworksResponse>({
    queryKey: ['outline-frameworks', user],
    queryFn: () => request(endpoint, OUTLINE_FRAMEWORKS_QUERY, { user }) as Promise<OutlineFrameworksResponse>,
    enabled: user !== undefined,
  });

  useEffect(() => {
    if (outlineData?.getOutlineFrameworks) {
      setFrameworks(outlineData.getOutlineFrameworks);
    }
  }, [outlineData, setFrameworks, user]);

  const createProjectMutation = useMutation({
    mutationFn: async (variables: Record<string, unknown>) => {
      await request(endpoint, CREATE_PROJECT, variables as Record<string, string>);
    },
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.refetchQueries({ queryKey: ['projects'] });
    },
  });

  const handleAddProject = useCallback(async (formValues: Record<string, unknown>) => {
    const userProfileState = useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;
    const displayName = userProfileState.userProfile?.displayName;
    const email = userProfileState.userProfile?.email ?? '';
    const withUser = {
      ...formValues,
      user,
      displayName,
      email,
    };
    createProjectMutation.mutate(withUser);
  }, []);

  if (!open) return null;

  return (
    <CreateProject
      setAddProject={setOpen}
      handleAddProject={handleAddProject}
    />
  );
}
