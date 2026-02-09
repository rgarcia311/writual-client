'use client';

import * as React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { PROJECT_QUERY } from '@/queries/ProjectQueries';
import { ProjectCard } from '@/components/ProjectCard';
import { projectStyles } from 'styles';
import { Project } from '@/interfaces/project';
import { useEffect } from 'react';
import { ProjectType } from '@/enums/ProjectEnums';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
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
  created_date: '',
  modified_date: '',
  revision: 0,
  sharedWith: [],
  type: ProjectType.Feature,
  budget: 0,
  timePeriod: '',
  similarProjects: [], 
  scenes: []
};

export function ProjectHeader() {
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string | undefined;
  const [expanded, setExpanded] = React.useState(true);
  const [projectData, setProjectData] = React.useState<Project>(defaultProjectData);
  const user = useUserProfileStore((s) => s.user)

  const variables = React.useMemo(
    () => ({ input: { user: user?.uid, _id: id } }),
    [id]
  );

  const fetchProject = async (): Promise<{ getProjectData: Project[] }> => {
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
      sx={{
        boxShadow: 'none',
        '&:before': { display: 'none' },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="project-header-content"
        id="project-header-header"
        sx={{ minHeight: 56, '& .MuiAccordionSummary-content': { my: 1.5 } }}
      >
        <Breadcrumbs aria-label="breadcrumb" sx={projectStyles.tableTopButtons}>
          <Link underline="hover" color="inherit" href="/projects">
            <Typography sx={{ width: '100%' }} variant="h6">
              Projects
            </Typography>
          </Link>
          {currentPageLabel ? (
            <Link underline="hover" color="inherit" href={projectHref}>
              <Typography sx={{ width: '100%' }} variant="h6">
                {projectTitle}
              </Typography>
            </Link>
          ) : null}
          <Typography sx={{ width: '100%', fontWeight: 700 }} variant="h6">
            {currentPageLabel ?? projectTitle}
          </Typography>
        </Breadcrumbs>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <ProjectCard
          enableCardShadow={false}
          maxWidth="100%"
          title={projectData.title}
          author={projectData.user}
          genre={projectData.genre}
          logline={projectData.logline}
          coverImage={
            projectData.poster?.trim()
              ? projectData.poster
              : process.env.NODE_ENV === 'development'
                ? '/dev_image.png'
                : undefined
          }
          projectId={id}
          sharedWith={projectData.sharedWith ?? []}
        />
      </AccordionDetails>
    </Accordion>
  );
}
