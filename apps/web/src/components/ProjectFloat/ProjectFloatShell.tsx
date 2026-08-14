'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import { CreateProject } from '@/components/CreateProject';
import { ProjectBreadcrumbBar } from './ProjectBreadcrumbBar';
import { FloatingProjectHero } from './FloatingProjectHero';
import { useProjectShellData } from './useProjectShellData';
import { ProjectShellDataProvider } from './ProjectShellDataContext';
import type { ProjectStatTileKey } from './buildProjectStatTiles';
import '@/styles/projectDetailsFloat.css';

export interface ProjectFloatShellProps {
  children: React.ReactNode;
  breadcrumbRightAdornment?: React.ReactNode;
  /** @deprecated Use breadcrumbRightAdornment */
  accordionAdornment?: React.ReactNode;
  pageChrome?: React.ReactNode;
  contentBleed?: boolean;
  /** Hide poster/info hero (e.g. screenplay — shown in side-panel stats tab instead). */
  hideFloatHero?: boolean;
  /** Extra class on the float root (e.g. `project-details-float-root--screenplay`). */
  shellClassName?: string;
  /** Show tracking stat tiles alongside poster/info in the hero row. */
  showFloatStatsRail?: boolean;
  floatStatsRailKeys?: ProjectStatTileKey[];
  /** Page content scrolls beneath the floating hero (characters route). */
  floatContentOverlay?: boolean;
  /**
   * Hero renders as an in-flow band and the page content fills the remaining
   * viewport height instead of scrolling under it (chat route).
   */
  floatContentFill?: boolean;
}

export function ProjectFloatShell({
  children,
  breadcrumbRightAdornment,
  accordionAdornment,
  pageChrome,
  contentBleed = false,
  hideFloatHero = false,
  shellClassName,
  showFloatStatsRail = false,
  floatStatsRailKeys,
  floatContentOverlay = false,
  floatContentFill = false,
}: ProjectFloatShellProps) {
  const rightAdornment = breadcrumbRightAdornment ?? accordionAdornment;
  const shellData = useProjectShellData();
  const {
    projectId,
    projectData,
    isLoading,
    currentPageLabel,
    projectTitle,
    projectHref,
    updateDialogOpen,
    openEdit,
    closeEdit,
    handleUpdateProject,
    handleDelete,
  } = shellData;

  const contentClassName = contentBleed
    ? 'project-details-float-content project-details-float-content--bleed'
    : 'project-details-float-content';

  /** Hero as an in-flow band above the content: stats-rail routes and fill routes. */
  const heroBand = (showFloatStatsRail || floatContentFill) && !floatContentOverlay;
  const contentFill = floatContentFill && !floatContentOverlay;

  const rootClassName = [
    'project-details-float-root',
    shellClassName ?? '',
    floatContentOverlay ? 'project-details-float-root--content-overlay' : '',
    heroBand ? 'project-details-float-root--with-stats-rail' : '',
    contentFill ? 'project-details-float-root--content-fill' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hero = projectId ? (
    <FloatingProjectHero
      projectData={projectData}
      projectId={projectId}
      isLoading={isLoading}
      showFloatStatsRail={showFloatStatsRail}
      floatStatsRailKeys={floatStatsRailKeys}
      floatContentOverlay={floatContentOverlay}
      heroInFlow={heroBand}
      onEditClick={openEdit}
      onDelete={handleDelete}
    />
  ) : null;

  const mainColumn = (
    <Box className="project-details-float-main">
      <Box className={contentClassName}>
        {pageChrome}
        {children}
      </Box>
    </Box>
  );

  const shellHero = hideFloatHero ? null : hero;

  return (
    <ProjectShellDataProvider value={shellData}>
      <Box
        className={rootClassName}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}
      >
        <ProjectBreadcrumbBar
          projectTitle={projectTitle}
          projectHref={projectHref}
          currentPageLabel={currentPageLabel}
          rightAdornment={rightAdornment}
        />

        {heroBand ? (
          <>
            {shellHero ? (
              <Box className="project-float-sticky-stats-band">
                {shellHero}
                <Box className="project-float-sticky-stats-gap" aria-hidden="true" />
              </Box>
            ) : null}
            {contentFill ? (
              mainColumn
            ) : (
              <Box className="project-details-float-scroll-host">
                {mainColumn}
                <Box className="project-characters-scroll-end-spacer" aria-hidden="true" />
              </Box>
            )}
          </>
        ) : (
          <>
            {shellHero}
            {mainColumn}
          </>
        )}

        {updateDialogOpen && (
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
