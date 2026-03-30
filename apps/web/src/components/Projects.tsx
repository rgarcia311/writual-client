'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box } from '@mui/system';
import { Tabs, Tab } from '@mui/material';
import { ProjectCard, ProjectCardSkeleton } from './ProjectCard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECTS_QUERY } from '../queries';
import { DELETE_PROJECT } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { computeProjectProgress } from '../utils/progress';

const endpoint = GRAPHQL_ENDPOINT;

export const Projects = () => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const userId = useUserProfileStore((s) => s.userProfile?.user);
    const pendingNewProject = useCreateProjectModalStore((s) => s.pendingNewProject);

    const { data }: any = useQuery({
        queryKey: ['projects', userId],
        queryFn: async () => request(endpoint, PROJECTS_QUERY, userId ? { input: { user: userId } } : undefined),
        enabled: userId != null,
    });

    const deleteProjectMutation = useMutation({
        mutationFn: (deleteProjectId: string) =>
          request(endpoint, DELETE_PROJECT, { deleteProjectId }),
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: ['projects'] });
          await queryClient.refetchQueries({ queryKey: ['projects'] });
        },
    });

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
            onEditClick={project._id ? () => router.push(`/project/${project._id}`) : undefined}
            hideBudgetAndSimilarProjects
            progress={computeProjectProgress(project)}
        />
    );

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '100%',
                height: '90%',
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

            <Box hidden={activeTab !== 0} sx={{ overflowY: 'auto', flex: 1 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {pendingNewProject && <ProjectCardSkeleton />}
                    {myProjects.map((project) => renderCard(project, true))}
                </Box>
            </Box>

            <Box hidden={activeTab !== 1} sx={{ overflowY: 'auto', flex: 1 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {sharedProjects.map((project) => renderCard(project, false))}
                </Box>
            </Box>
        </Box>
    )
}