'use client';

/**
 * @deprecated Use `ProjectFloatShell` from `@/components/ProjectFloat`.
 */
import * as React from 'react';
import { ProjectBreadcrumbBar } from '@/components/ProjectFloat/ProjectBreadcrumbBar';
import { useProjectShellData } from '@/components/ProjectFloat/useProjectShellData';
import { CreateProject } from '@/components/CreateProject';

export function ProjectHeader({
  accordionAdornment,
  rightAdornment,
}: {
  accordionAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
}) {
  const adornment = rightAdornment ?? accordionAdornment;
  const {
    projectData,
    currentPageLabel,
    projectTitle,
    projectHref,
    updateDialogOpen,
    closeEdit,
    handleUpdateProject,
  } = useProjectShellData();

  return (
    <>
      <ProjectBreadcrumbBar
        projectTitle={projectTitle}
        projectHref={projectHref}
        currentPageLabel={currentPageLabel}
        rightAdornment={adornment}
      />
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
    </>
  );
}
