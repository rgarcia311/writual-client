'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { useOutlineFrameworksStore } from '@/state/outlineFrameworks';
import { CreateProject } from '@/components/CreateProject';
import { AppAlert } from '@/components/AppAlert';
import { CREATE_PROJECT } from '@mutations/ProjectMutations';
import { SAVE_SCREENPLAY } from '@mutations/ScreenplayMutations';
import { OUTLINE_FRAMEWORKS_QUERY } from '@/queries/OutlineQueries';
import type { OutlineFrameworkItem } from '@/state/outlineFrameworks';
import { authRequest } from '@/lib/authRequest';
import { useUserProfileStore } from '@/state/user';

interface OutlineFrameworksResponse {
  getOutlineFrameworks?: OutlineFrameworkItem[];
}

export function CreateProjectWrapper() {
  const open = useCreateProjectModalStore((s) => s.open);
  const setFrameworks = useOutlineFrameworksStore((s) => s.setFrameworks);
  const [user, setUser] = useState<string | undefined>();
  const [displayName, setDisplayName] = useState<string | undefined>();
  const [email, setEmail] = useState<string>('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const setOpen = useCreateProjectModalStore((s) => s.setOpen);
  const setPendingNewProject = useCreateProjectModalStore((s) => s.setPendingNewProject);
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
    queryFn: () => authRequest<OutlineFrameworksResponse>(OUTLINE_FRAMEWORKS_QUERY, { user }),
    enabled: user !== undefined,
  });

  useEffect(() => {
    if (outlineData?.getOutlineFrameworks) {
      setFrameworks(outlineData.getOutlineFrameworks);
    }
  }, [outlineData, setFrameworks, user]);

  const createProjectMutation = useMutation({
    mutationFn: async (variables: Record<string, unknown>) => {
      const { screenplayContent, ...projectVars } = variables;
      const result = await authRequest<{ createProject?: { _id: string } }>(
        CREATE_PROJECT,
        projectVars as Record<string, string>,
      );
      const newProjectId = result?.createProject?._id;
      if (newProjectId && screenplayContent) {
        try {
          await authRequest(SAVE_SCREENPLAY, {
            projectId: newProjectId,
            content: screenplayContent,
          });
        } catch (err) {
          console.error('[CreateProjectWrapper] Failed to save imported screenplay:', err);
          setAlertMessage('Project created but the imported screenplay could not be saved. Please try re-importing from the project page.');
          setAlertOpen(true);
        }
      }
    },
    onMutate: () => {
      setPendingNewProject(true);
    },
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.refetchQueries({ queryKey: ['projects'] });
    },
    onSettled: () => {
      setPendingNewProject(false);
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
    <>
      <CreateProject
        setAddProject={setOpen}
        handleAddProject={handleAddProject}
      />
      <AppAlert
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        message={alertMessage}
        severity="error"
      />
    </>
  );
}
