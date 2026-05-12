'use client';

import { useState, useCallback } from 'react';
import { Box } from '@mui/system';
import { Tabs, Tab } from '@mui/material';
import { ProjectCard, ProjectCardSkeleton } from './ProjectCard';
import { CreateProject } from './CreateProject';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PROJECTS_QUERY } from '../queries';
import { UPDATE_PROJECT, DELETE_PROJECT } from 'mutations/ProjectMutations';
import { authRequest } from '@/lib/authRequest';
import { useUserProfileStore } from '@/state/user';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { computeProjectProgress } from '../utils/progress';

export const Projects = () => {
    const queryClient = useQueryClient();
    const userId = useUserProfileStore((s) => s.userProfile?.user);
    const pendingNewProject = useCreateProjectModalStore((s) => s.pendingNewProject);

    const [editingProject, setEditingProject] = useState<any>(null);

    const { data }: any = useQuery({
        queryKey: ['projects', userId],
        queryFn: async () => authRequest(PROJECTS_QUERY, userId ? { input: { user: userId } } : undefined),
        enabled: userId != null,
    });

    const deleteProjectMutation = useMutation({
        mutationFn: (deleteProjectId: string) =>
          authRequest(DELETE_PROJECT, { deleteProjectId }),
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: ['projects'] });
          await queryClient.refetchQueries({ queryKey: ['projects'] });
        },
    });

    const updateProjectMutation = useMutation({
        mutationFn: async (variables: Record<string, unknown>) => {
          await authRequest(UPDATE_PROJECT, variables);
        },
        onSuccess: async () => {
          setEditingProject(null);
          await queryClient.invalidateQueries({ queryKey: ['projects'] });
          await queryClient.refetchQueries({ queryKey: ['projects'] });
        },
    });

    const handleUpdateProject = useCallback(
        (formValues: Record<string, unknown>) => {
          const projectId = editingProject?._id;
          const userProfileState = useUserProfileStore.getState();
          const user = userProfileState.userProfile?.user;
          const displayName = userProfileState.userProfile?.displayName;
          const email = userProfileState.userProfile?.email ?? '';
          if (!projectId || !user) return;
          const similarProjects = Array.isArray(formValues.similarProjects)
            ? formValues.similarProjects
            : typeof formValues.similarProjects === 'string'
              ? (formValues.similarProjects as string).split(',').map((s) => s.trim()).filter(Boolean)
              : [];
          updateProjectMutation.mutate({
            _id: projectId,
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
          });
        },
        [editingProject, updateProjectMutation]
    );

    const [activeTab, setActiveTab] = useState(0);

    const allProjects: any[] = data?.getProjectData ?? [];
    const myProjects = allProjects.filter((p) => p.user === userId);
    const sharedProjects = allProjects.filter((p) => p.user !== userId);

    const renderCard = (project: any, isOwner: boolean) => (
        <ProjectCard
            key={project._id}
            title={project.title}
            author={project.displayName ?? project.email ?? project.user ?? 'TBD'}
            genre={project.genre}
            logline={project.logline}
            coverImage={project.coverImage ?? project.poster}
            onDelete={isOwner && project._id ? () => deleteProjectMutation.mutate(project._id) : undefined}
            projectId={project._id}
            projectTypeLabel={project.type}
            to={project._id ? `/project/${project._id}` : undefined}
            onEditClick={project._id ? () => setEditingProject(project) : undefined}
            hideBudgetAndSimilarProjects
            progress={computeProjectProgress(project)}
        />
    );

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '100%',
                flex: 1,
                minHeight: 0,
                alignSelf: 'stretch',
                overflowX: 'hidden',
                padding: 2,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
                <Tab label="My Projects" />
                <Tab label={sharedProjects.length > 0 ? `Shared With Me (${sharedProjects.length})` : 'Shared With Me'} />
            </Tabs>

            <Box hidden={activeTab !== 0} sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {pendingNewProject && <ProjectCardSkeleton />}
                    {myProjects.map((project) => renderCard(project, true))}
                </Box>
            </Box>

            <Box hidden={activeTab !== 1} sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {sharedProjects.map((project) => renderCard(project, false))}
                </Box>
            </Box>

            {editingProject && (
                <CreateProject
                    setAddProject={(open) => { if (!open) setEditingProject(null); }}
                    handleAddProject={() => {}}
                    initialData={{ ...editingProject, _id: editingProject._id }}
                    handleUpdateProject={handleUpdateProject}
                />
            )}
        </Box>
    )
}