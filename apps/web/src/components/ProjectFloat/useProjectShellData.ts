'use client';

import * as React from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_QUERY } from '@/queries/ProjectQueries';
import { Project } from '@/interfaces/project';
import { ProjectType } from '@/enums/ProjectEnums';
import { UPDATE_PROJECT, DELETE_PROJECT } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { authRequest } from '@/lib/authRequest';
import { useUserProfileStore } from '@/state/user';
import { computeProjectProgress, computeWritingTrackerStatus } from '../../utils/progress';
import { deriveScreenplayPresenceStats } from '../../utils/projectScreenplayStats';
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages';
import type { DevelopmentLockSummary, DraftDeadline, ProgressItem } from '../../utils/progress';
import { computeProjectStatTileData } from './computeProjectStatTileData';

const endpoint = GRAPHQL_ENDPOINT;

const SEGMENT_LABELS: Record<string, string> = {
  characters: 'Characters',
  outline: 'Outline',
  screenplay: 'Screenplay',
  chat: 'Chat',
};

export const defaultProjectData: Project = {
  title: '',
  user: '',
  genre: '',
  logline: '',
  id: '',
  displayName: '',
  email: '',
  created_date: '',
  modified_date: '',
  revision: 0,
  sharedWith: [],
  type: ProjectType.Feature,
  budget: 0,
  timePeriod: '',
  similarProjects: [],
  scenes: [],
  inspiration: [],
  writingTracker: null,
};

function getCurrentPageLabel(pathname: string | null, projectId: string | undefined): string | null {
  if (!pathname || !projectId) return null;
  const segments = pathname.split('/').filter(Boolean);
  const projectIndex = segments.indexOf('project');
  const idIndex = projectIndex + 1;
  const sectionSegment = segments[idIndex + 1];
  if (!sectionSegment) return null;
  return SEGMENT_LABELS[sectionSegment] ?? sectionSegment;
}

export interface ProjectStatTileData {
  progress: ProgressItem[];
  developmentLocks: DevelopmentLockSummary;
  /** Draft due dates in date order for the Deadline Tracking tile. */
  draftDeadlines: DraftDeadline[];
  /** Project identity for tile-level mutations; fields are blank when a query omits them. */
  projectRef: { id: string; user: string; title: string; type?: string };
  writingTracker: Project['writingTracker'];
  writingTrackerStatus: ReturnType<typeof computeWritingTrackerStatus>;
  progressTrackingEnabled: boolean;
  topCharactersByScenes: Array<{ name: string; sceneCount: number; imageUrl: string | null }>;
  screenplayPresence: ReturnType<typeof deriveScreenplayPresenceStats> | null;
  characterRosterLength: number;
}

export function useProjectShellData() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const queryClient = useQueryClient();
  const [updateDialogOpen, setUpdateDialogOpen] = React.useState(false);

  const fetchProject = React.useCallback(async (): Promise<{ getProjectData: Project[] }> => {
    const { userProfile } = useUserProfileStore.getState();
    const variables = { input: { user: userProfile?.user, _id: id } };
    return request(endpoint, PROJECT_QUERY, variables);
  }, [id]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project', id],
    queryFn: fetchProject,
    enabled: Boolean(id),
  });

  const projectData = data?.getProjectData?.[0] ?? defaultProjectData;
  const projectId = id;
  const currentPageLabel = getCurrentPageLabel(pathname, id);
  const projectTitle = projectData.title || 'Project';
  const projectHref = id ? `/project/${id}` : '/projects';

  const liveBodyPages = useScreenplayLivePagesStore((s) =>
    projectId && s.projectId === projectId ? s.liveBodyPages : null,
  );

  const writingTracker = (projectData as { writingTracker?: Project['writingTracker'] }).writingTracker ?? null;

  const progress = React.useMemo(
    () => computeProjectProgress(projectData as Parameters<typeof computeProjectProgress>[0]),
    [projectData],
  );

  const statTileData: ProjectStatTileData = React.useMemo(
    () =>
      computeProjectStatTileData(
        projectData as Parameters<typeof computeProjectStatTileData>[0],
        liveBodyPages,
      ),
    [projectData, liveBodyPages],
  );

  const updateProjectMutation = useMutation({
    mutationFn: async (variables: Record<string, unknown>) => {
      await authRequest(UPDATE_PROJECT, variables);
    },
    onSuccess: async () => {
      if (id) {
        await queryClient.invalidateQueries({ queryKey: ['project', id] });
        await queryClient.refetchQueries({ queryKey: ['project', id] });
      }
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setUpdateDialogOpen(false);
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (deleteProjectId: string) => authRequest(DELETE_PROJECT, { deleteProjectId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/projects');
    },
  });

  const handleUpdateProject = React.useCallback(
    (formValues: Record<string, unknown>) => {
      const userProfileState = useUserProfileStore.getState();
      const user = userProfileState.userProfile?.user;
      const displayName = userProfileState.userProfile?.displayName;
      const email = userProfileState.userProfile?.email ?? '';
      const resolvedProjectId = (projectData as { _id?: string })._id ?? projectData.id;
      if (!resolvedProjectId || !user) return;
      const similarProjects = Array.isArray(formValues.similarProjects)
        ? formValues.similarProjects
        : typeof formValues.similarProjects === 'string'
          ? (formValues.similarProjects as string).split(',').map((s) => s.trim()).filter(Boolean)
          : [];
      updateProjectMutation.mutate({
        _id: resolvedProjectId,
        title: formValues.title,
        type: formValues.type,
        user,
        displayName,
        email,
        logline: formValues.logline,
        genre: formValues.genre,
        poster: formValues.poster,
        outlineName: formValues.outlineName,
        sharedWith: formValues.sharedWith,
        budget: formValues.budget != null && formValues.budget !== '' ? Number(formValues.budget) : undefined,
        similarProjects,
        timePeriod: formValues.timePeriod ?? undefined,
        writingTracker: formValues.writingTracker ?? undefined,
      });
    },
    [projectData, updateProjectMutation],
  );

  const openEdit = React.useCallback(() => setUpdateDialogOpen(true), []);
  const closeEdit = React.useCallback(() => setUpdateDialogOpen(false), []);

  const handleDelete = React.useCallback(() => {
    if (id) deleteProjectMutation.mutate(id);
  }, [id, deleteProjectMutation]);

  return {
    projectId,
    projectData,
    isLoading,
    isError,
    currentPageLabel,
    projectTitle,
    projectHref,
    statTileData,
    progress,
    writingTracker,
    updateDialogOpen,
    openEdit,
    closeEdit,
    handleUpdateProject,
    handleDelete,
  };
}
