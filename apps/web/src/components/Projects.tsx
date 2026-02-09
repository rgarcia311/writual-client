'use client';

import { Button } from "@mui/material";
import { Box } from "@mui/system";
import { ProjectCard } from "./ProjectCard";
import AddIcon from '@mui/icons-material/Add';
import React, { useEffect } from "react";
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "graphql-request";
import { PROJECTS_QUERY } from "../queries";
import { DELETE_PROJECT } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';

const endpoint = GRAPHQL_ENDPOINT;


export const Projects = () => {
    const queryClient = useQueryClient();

    const openCreateProjectModal = useCreateProjectModalStore((s) => s.openModal)

    const { data }: any = useQuery({ queryKey: ['projects'], queryFn: async () => request(endpoint, PROJECTS_QUERY) })

    const deleteProjectMutation = useMutation({
        mutationFn: (deleteProjectId: string) =>
          request(endpoint, DELETE_PROJECT, { deleteProjectId }),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
      });
    

    return (
        <>
        <Box sx={{ display: 'flex', justifyContent: 'center', paddingTop: 2, paddingBottom: 2 }}>
                    <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={openCreateProjectModal}
                    >
                    Create Project
                    </Button>
                </Box>

                <Box
                    sx={{
                    height: '100%',
                    paddingTop: 5,
                    overflowY: 'scroll',
                    display: 'flex',
                    justifyContent: 'space-evenly',
                    flexWrap: 'wrap',
                    gap: 2,
                    }}
                >
                    {data?.getProjectData?.map((project: any, index: number) => (
                    <Box
                        key={project._id ?? index}
                        sx={{  marginTop: '20px', flexShrink: 0 }}
                    >
                        <ProjectCard
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
                    </Box>
                    ))}
                </Box>
        </>
    )
}