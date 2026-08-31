'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import { CreateProject } from '@/components/CreateProject';
import { ProjectBreadcrumbBar } from './ProjectBreadcrumbBar';
import { BreadcrumbDevelopmentProgress } from './BreadcrumbDevelopmentProgress';
import { FloatingProjectHero } from './FloatingProjectHero';
import { useProjectShellData } from './useProjectShellData';
import { ProjectShellDataProvider } from './ProjectShellDataContext';
import {
  ALL_PROJECT_STAT_TILE_KEYS,
  PROJECT_HERO_CARD_KEYS,
  PROJECT_RAIL_STAT_KEYS,
} from './buildProjectStatTiles';
import type { ProjectStatTileKey } from './buildProjectStatTiles';
import { StatTileVisibilityMenu } from './StatTileVisibilityMenu';
import { useStatTilePreferences } from '@/hooks/useStatTilePreferences';
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
  /** Tiles this page shows until the user picks their own set from the breadcrumb-bar menu. */
  floatStatsRailKeys?: ProjectStatTileKey[];
  /**
   * Keep the hero (with its stat tiles) in normal flow and let page content fill the rest of the
   * height, instead of the sticky band + scrolling content host the other rail pages use. For
   * pages whose content scrolls internally and must reach the viewport bottom (chat).
   */
  floatStatsRailInFlow?: boolean;
  /** Page content scrolls beneath the floating hero (characters route). */
  floatContentOverlay?: boolean;
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
  floatStatsRailInFlow = false,
  floatContentOverlay = false,
}: ProjectFloatShellProps) {
  const pageAdornment = breadcrumbRightAdornment ?? accordionAdornment;
  const shellData = useProjectShellData();
  const {
    projectId,
    projectData,
    isLoading,
    currentPageLabel,
    statPageKey,
    projectTitle,
    projectHref,
    progress,
    writingTracker,
    statTileData,
    updateDialogOpen,
    openEdit,
    closeEdit,
    handleUpdateProject,
    handleDelete,
  } = shellData;

  // Pages name the stat tiles they want; the poster and details cards are on by default everywhere
  // and are removed only when the user unchecks them in the card picker.
  const defaultStatKeys = floatStatsRailKeys
    ? [...PROJECT_HERO_CARD_KEYS, ...floatStatsRailKeys]
    : ALL_PROJECT_STAT_TILE_KEYS;
  const { selectedKeys, toggleKey, resetToDefault, isDefault, canPersist } = useStatTilePreferences({
    pageKey: statPageKey,
    defaultKeys: defaultStatKeys,
    enabled: showFloatStatsRail,
  });

  // The picker sits ahead of the page's own action so the action stays in the far corner.
  const rightAdornment =
    showFloatStatsRail && canPersist ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StatTileVisibilityMenu
          selectedKeys={selectedKeys}
          onToggleKey={toggleKey}
          onResetToDefault={resetToDefault}
          isDefault={isDefault}
        />
        {pageAdornment}
      </Box>
    ) : (
      pageAdornment
    );

  // Without the picker (no rail on this page) the hero cards always show — nothing can hide them.
  const showPoster = !showFloatStatsRail || selectedKeys.includes('poster');
  const showDetails = !showFloatStatsRail || selectedKeys.includes('details');
  const hasRailTiles =
    showFloatStatsRail && PROJECT_RAIL_STAT_KEYS.some((key) => selectedKeys.includes(key));
  const heroHasCards = showPoster || showDetails || hasRailTiles;

  const contentClassName = contentBleed
    ? 'project-details-float-content project-details-float-content--bleed'
    : 'project-details-float-content';

  // In-flow pages keep the plain shell layout: the `--with-stats-rail` rules hand scrolling to a
  // host element, which would strand a chat pane's message input past the bottom edge.
  const stickyStatsRail = showFloatStatsRail && !floatContentOverlay && !floatStatsRailInFlow;

  const rootClassName = [
    'project-details-float-root',
    shellClassName ?? '',
    floatContentOverlay ? 'project-details-float-root--content-overlay' : '',
    stickyStatsRail ? 'project-details-float-root--with-stats-rail' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hero = projectId && heroHasCards ? (
    <FloatingProjectHero
      projectData={projectData}
      projectId={projectId}
      isLoading={isLoading}
      showFloatStatsRail={showFloatStatsRail}
      floatStatsRailKeys={selectedKeys}
      floatContentOverlay={floatContentOverlay}
      showPoster={showPoster}
      showDetails={showDetails}
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
          breadcrumbAdornment={
            <BreadcrumbDevelopmentProgress
              progress={progress}
              tracker={writingTracker}
              status={statTileData.writingTrackerStatus}
            />
          }
          rightAdornment={rightAdornment}
        />

        {stickyStatsRail ? (
          <>
            {shellHero ? (
              <Box className="project-float-sticky-stats-band">
                {shellHero}
                <Box className="project-float-sticky-stats-gap" aria-hidden="true" />
              </Box>
            ) : null}
            <Box className="project-details-float-scroll-host">
              {mainColumn}
              <Box className="project-characters-scroll-end-spacer" aria-hidden="true" />
            </Box>
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
