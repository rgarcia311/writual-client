'use client';

import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_QUERY } from '@/queries/ProjectQueries';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProject } from '@/components/CreateProject';
import { accordionFlat, projectStyles } from 'styles';
import { Project } from '@/interfaces/project';
import { useEffect } from 'react';
import { computeProjectProgress } from '../../utils/progress';
import { ProjectType } from '@/enums/ProjectEnums';
import { UPDATE_PROJECT, DELETE_PROJECT } from 'mutations/ProjectMutations';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { authRequest } from '@/lib/authRequest';
import { useUserProfileStore } from '@/state/user';

const endpoint = GRAPHQL_ENDPOINT;

const SEGMENT_LABELS: Record<string, string> = {
  characters: 'Characters',
  outline: 'Outline',
  treatment: 'Treatment',
  screenplay: 'Screenplay',
  chat: 'Chat',
};

/** Get current page label from pathname e.g. /project/123/characters -> "Characters" */
function getCurrentPageLabel(pathname: string | null, projectId: string | undefined): string | null {
  if (!pathname || !projectId) return null;
  const segments = pathname.split('/').filter(Boolean);
  const projectIndex = segments.indexOf('project');
  const idIndex = projectIndex + 1;
  const sectionSegment = segments[idIndex + 1];
  if (!sectionSegment) return null;
  return SEGMENT_LABELS[sectionSegment] ?? sectionSegment;
}

const defaultProjectData: Project = {
  title: "",
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
  inspiration: []
};

export function ProjectHeader({ accordionAdornment }: { accordionAdornment?: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = React.useState(true);
  const [projectData, setProjectData] = React.useState<Project>(defaultProjectData);
  const [updateDialogOpen, setUpdateDialogOpen] = React.useState(false);

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
    mutationFn: (deleteProjectId: string) =>
      authRequest(DELETE_PROJECT, { deleteProjectId }),
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
      const projectId = (projectData as { _id?: string })._id ?? projectData.id;
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
    [projectData, updateProjectMutation]
  );

  const fetchProject = async (): Promise<{ getProjectData: Project[] }> => {
    const { userProfile } = await useUserProfileStore.getState()
    const variables = { input: { user: userProfile?.user, _id: id } }
    return await request(endpoint, PROJECT_QUERY, variables)
  };

  const { data } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (data?.getProjectData?.length) {
      setProjectData(data?.getProjectData[0])
    } else {
      setProjectData(defaultProjectData)
    }
  }, [data])

  const currentPageLabel = getCurrentPageLabel(pathname, id);
  const projectTitle = projectData.title || 'Project';
  const projectHref = id ? `/project/${id}` : '/projects';

  const handleAccordionChange = (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded);
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={handleAccordionChange}
      disableGutters
      sx={{ ...accordionFlat, borderBottom: 1, borderColor: 'divider', paddingLeft: '12px' }}
    >
      <AccordionSummary
        component="div"
        expandIcon={<ExpandMoreIcon />}
        aria-controls="project-header-content"
        id="project-header-header"
        sx={{
          p: 0,
          minHeight: 0,
          py: 0,
          alignItems: 'center',
          '& .MuiAccordionSummary-content': {
            my: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            width: '100%',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, mr: 1, pb: 2, pt: '4px' }}>
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{
              ...projectStyles.tableTopButtons,
              minWidth: 0,
              width: '100%',
              height: 'auto',
              minHeight: 0,
              alignItems: 'center',
            }}
          >
            <Link 
              underline="hover" 
              color="inherit" 
              href="/projects"
              onClick={(e) => e.stopPropagation()}
            >
              <Typography sx={{ width: '100%' }} variant="h6">
                Projects
              </Typography>
            </Link>
            {currentPageLabel ? (
              <Link 
                underline="hover" 
                color="inherit"  
                href={projectHref}
                onClick={(e) => e.stopPropagation()}
              >
                <Typography sx={{ width: '100%' }} variant="h6">
                  {projectTitle}
                </Typography>
              </Link>
            ) : null}
            <Typography sx={{ width: '100%', fontWeight: 700 }} variant="h6">
              {currentPageLabel ?? projectTitle}
            </Typography>
          </Breadcrumbs>
        </Box>
        {accordionAdornment && (
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {accordionAdornment}
          </Box>
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, p: 0, pb: 2 }}>
        <ProjectCard
          padding={0}
          enableCardShadow={false}
          maxWidth="100%"
          headerOnly
          title={projectData.title}
          author={projectData.displayName ?? projectData.email ?? projectData.user ?? 'TBD'}
          genre={projectData.genre}
          logline={projectData.logline}
          projectTypeLabel={projectData.type}
          budget={projectData.budget}
          similarProjects={projectData.similarProjects ?? []}
          coverImage={
            projectData.poster?.trim()
              ? projectData.poster
              : '/default-film-poster.png'
          }
          projectId={id}
          onEditClick={() => setUpdateDialogOpen(true)}
          onDelete={id ? () => deleteProjectMutation.mutate(id) : undefined}
          progress={computeProjectProgress(projectData as any)}
        />
      </AccordionDetails>
      {updateDialogOpen && (
        <CreateProject
          setAddProject={setUpdateDialogOpen}
          handleAddProject={() => {}}
          initialData={{
            ...projectData,
            _id: (projectData as { _id?: string })._id ?? projectData.id,
          }}
          handleUpdateProject={handleUpdateProject}
        />
      )}
    </Accordion>
  );
}
