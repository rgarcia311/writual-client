'use client';

import * as React from 'react';
import type { useProjectShellData } from './useProjectShellData';

export type ProjectShellData = ReturnType<typeof useProjectShellData>;

const ProjectShellDataContext = React.createContext<ProjectShellData | null>(null);

export function ProjectShellDataProvider({
  value,
  children,
}: {
  value: ProjectShellData;
  children: React.ReactNode;
}) {
  return (
    <ProjectShellDataContext.Provider value={value}>{children}</ProjectShellDataContext.Provider>
  );
}

export function useProjectShellContext(): ProjectShellData {
  const ctx = React.useContext(ProjectShellDataContext);
  if (!ctx) {
    throw new Error('useProjectShellContext must be used within ProjectFloatShell');
  }
  return ctx;
}
