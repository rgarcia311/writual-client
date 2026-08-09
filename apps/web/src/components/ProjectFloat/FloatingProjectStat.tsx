'use client';

import * as React from 'react';
import { buildProjectStatTiles } from './buildProjectStatTiles';
import type { ProjectStatTileData } from './useProjectShellData';
import type { ProjectStatTileKey } from './buildProjectStatTiles';
import { FloatingStatSurface } from './FloatingStatSurface';

export interface FloatingProjectStatProps {
  statKey: ProjectStatTileKey;
  statTileData: ProjectStatTileData;
  className?: string;
}

export function FloatingProjectStat({ statKey, statTileData, className }: FloatingProjectStatProps) {
  const tiles = React.useMemo(() => buildProjectStatTiles(statTileData), [statTileData]);
  const entry = tiles.find((t) => t.key === statKey);
  if (!entry) return null;

  return (
    <FloatingStatSurface className={className}>
      {entry.node}
    </FloatingStatSurface>
  );
}
