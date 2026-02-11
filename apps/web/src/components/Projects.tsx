'use client';

import { Box } from "@mui/system";
import { ProjectCard } from "./ProjectCard";
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "graphql-request";
import { PROJECTS_QUERY } from "../queries";
import { DELETE_PROJECT } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';

const endpoint = GRAPHQL_ENDPOINT;

export const Projects = () => {
    const queryClient = useQueryClient();
    const userId = useUserProfileStore((s) => s.userProfile?.user);

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
                    height: '100%',
                    paddingTop: 5,
                    overflowY: 'scroll',
                    display: 'flex',
                    //justifyContent: 'space-evenly',
                    flexWrap: 'wrap',
                    gap: 2,
                    padding: 2
                    }}
                >
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
                        sharedWith={project.sharedWith ?? []}
                        to={project._id ? `/project/${project._id}` : undefined}
                        />
                    ))}
                </Box>
    )
}