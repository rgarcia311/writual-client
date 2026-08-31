'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import { CreateProject } from '@/components/CreateProject';
import { ProjectBreadcrumbBar } from '@/components/ProjectFloat/ProjectBreadcrumbBar';
import { BreadcrumbDevelopmentProgress } from '@/components/ProjectFloat/BreadcrumbDevelopmentProgress';
import { useProjectShellData } from '@/components/ProjectFloat/useProjectShellData';
import { ProjectShellDataProvider } from '@/components/ProjectFloat/ProjectShellDataContext';

interface ScreenplayShellProps {
  children: React.ReactNode;
  breadcrumbRightAdornment?: React.ReactNode;
}

/**
 * Minimal shell for the screenplay route.
 * Replaces the 6-layer ProjectDetailsLayout → ProjectFloatShell → content stack with
 * a single root Box + single content Box, both with overflow: visible, so the floating
 * surface shadows can bleed through to the page padding without CSS !important battles.
 */
export function ScreenplayShell({ children, breadcrumbRightAdornment }: ScreenplayShellProps) {
  const shellData = useProjectShellData();
  const {
    projectTitle,
    projectHref,
    currentPageLabel,
    progress,
    writingTracker,
    statTileData,
    updateDialogOpen,
    closeEdit,
    handleUpdateProject,
    projectData,
  } = shellData;

  return (
    <ProjectShellDataProvider value={shellData}>
      <Box
        className="project-details-float-root project-details-float-root--screenplay"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'visible',
        }}
      >
        <ProjectBreadcrumbBar
          projectTitle={projectTitle}
          projectHref={projectHref}
          currentPageLabel={currentPageLabel}
          breadcrumbAdornment={
            <BreadcrumbDevelopmentProgress
              progress={progress}
              tracker={writingTracker}
              status={statTileData.writingTrackerStatus}
            />
          }
          rightAdornment={breadcrumbRightAdornment}
        />

        <Box
          className="screenplay-editor-shell"
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
          }}
        >
          {children}
        </Box>

        {updateDialogOpen && projectData && (
          <CreateProject
            setAddProject={closeEdit}
            handleAddProject={() => {}}
            initialData={{
              ...projectData,
              _id: (projectData as { _id?: string })._id ?? projectData.id,
              writingTracker: (projectData as { writingTracker?: unknown }).writingTracker ?? null,
            }}
            handleUpdateProject={handleUpdateProject}
          />
        )}
      </Box>
    </ProjectShellDataProvider>
  );
}
