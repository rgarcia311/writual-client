'use client';

import { Box } from '@mui/system';
import { ProjectCard, ProjectCardSkeleton } from './ProjectCard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECTS_QUERY } from '../queries';
import { DELETE_PROJECT } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useCreateProjectModalStore } from '@/state/createProjectModal';

const endpoint = GRAPHQL_ENDPOINT;

export const Projects = () => {
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

    return (
                <Box
                    sx={{
                    width: '100%',
                    maxWidth: '100%',
                    height: '90%',
                    paddingTop: 5,
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    padding: 2,
                    minWidth: 0,
                    }}
                >
                    {pendingNewProject && <ProjectCardSkeleton />}
                    {data?.getProjectData?.map((project: any, index: number) => (
                  
                      <ProjectCard
                        key={project._id}
                        title={project.title}
                        author={project.displayName ?? project.email ?? project.user ?? 'TBD'}
                        genre={project.genre}
                        logline={project.logline}
                        coverImage={project.coverImage ?? project.poster}
                        onDelete={project._id ? () => deleteProjectMutation.mutate(project._id) : undefined}
                        projectId={project._id}
                        projectTypeLabel={project.type}
                        sharedWith={project.sharedWith ?? []}
                        to={project._id ? `/project/${project._id}` : undefined}
                        hideBudgetAndSimilarProjects
                      />
                    ))}
                </Box>
    )
}