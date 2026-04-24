'use client'

import * as React from 'react'
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout'
import { WritualEditor } from '@/components/ScreenplayEditor'
import { ScreenplayHeaderChrome } from '@/components/ScreenplayEditor/ScreenplayHeaderChrome'
import { FeatureGate } from '@/components/Auth/FeatureGate'

export function ScreenplayView({ projectId }: { projectId: string }) {
  return (
    <ProjectDetailsLayout
      accordionAdornment={<ScreenplayHeaderChrome />}
      contentSx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        p: 0,
        pt: 0,
        paddingTop: '0 !important',
        overflow: 'hidden',
      }}
    >
      <FeatureGate minTier="spec" variant="page">
        <WritualEditor projectId={projectId} />
      </FeatureGate>
    </ProjectDetailsLayout>
  )
}
