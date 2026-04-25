'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { AlertColor } from '@mui/material/Alert';
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
import { getApiOrigin } from '@/lib/config';
import { getFirebaseAuth } from '@/lib/firebase';
import { TIER_RANK, type Tier } from '@/types/tier';

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
  const [alertSeverity, setAlertSeverity] = useState<AlertColor>('error');
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

  const tier = useUserProfileStore((s) => (s.userProfile?.tier ?? 'spec') as Tier);
  const screenplayImportMode =
    TIER_RANK[tier] >= TIER_RANK['greenlit'] ? 'server' : 'client';

  const createProjectMutation = useMutation({
    mutationFn: async (variables: Record<string, unknown>) => {
      const { screenplayContent, screenplayPdfFile, ...projectVars } = variables;
      const result = await authRequest<{ createProject?: { _id: string } }>(
        CREATE_PROJECT,
        projectVars as Record<string, string>,
      );
      const newProjectId = result?.createProject?._id;
      if (!newProjectId) return;

      const pdfFile = screenplayPdfFile instanceof File ? screenplayPdfFile : null;
      const useAiImport =
        screenplayImportMode === 'server' && pdfFile != null;

      if (useAiImport) {
        try {
          const token = await getFirebaseAuth().currentUser?.getIdToken();
          const fd = new FormData();
          fd.append('projectId', newProjectId);
          fd.append('file', pdfFile);
          const origin = getApiOrigin();
          const r = await fetch(`${origin}/api/screenplay/import-pdf-ai`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
            signal: AbortSignal.timeout(600_000),
          });
          let body: {
            error?: string;
            entityErrors?: string[];
            ok?: boolean;
          } = {};
          try {
            body = (await r.json()) as typeof body;
          } catch {
            /* ignore */
          }
          if (!r.ok) {
            console.error('[CreateProjectWrapper] AI import failed:', body);
            setAlertSeverity('error');
            setAlertMessage(
              typeof body.error === 'string'
                ? body.error
                : 'AI screenplay import failed. The project was created.',
            );
            setAlertOpen(true);
          } else if (
            Array.isArray(body.entityErrors) &&
            body.entityErrors.length > 0
          ) {
            const preview = body.entityErrors.slice(0, 3).join('; ');
            const more =
              body.entityErrors.length > 3
                ? ` (+${body.entityErrors.length - 3} more)`
                : '';
            setAlertSeverity('warning');
            setAlertMessage(
              `Project created. Some outline or character rows could not be saved: ${preview}${more}`,
            );
            setAlertOpen(true);
          }
        } catch (err) {
          console.error('[CreateProjectWrapper] AI import request failed:', err);
          setAlertSeverity('error');
          setAlertMessage(
            'Project created but the AI import request failed. Please try again from the project page.',
          );
          setAlertOpen(true);
        }
        return;
      }

      if (screenplayContent) {
        try {
          await authRequest(SAVE_SCREENPLAY, {
            projectId: newProjectId,
            content: screenplayContent,
          });
        } catch (err) {
          console.error('[CreateProjectWrapper] Failed to save imported screenplay:', err);
          setAlertSeverity('error');
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
        screenplayImportMode={screenplayImportMode}
      />
      <AppAlert
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        message={alertMessage}
        severity={alertSeverity}
      />
    </>
  );
}
