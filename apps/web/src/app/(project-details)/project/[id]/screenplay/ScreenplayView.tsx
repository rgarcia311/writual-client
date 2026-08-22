'use client'

import * as React from 'react'
import { WritualEditor } from '@/components/ScreenplayEditor'
import { ScreenplayShell } from '@/components/ScreenplayEditor/ScreenplayShell'
import { ScreenplayHeaderChrome } from '@/components/ScreenplayEditor/ScreenplayHeaderChrome'
import { ScreenplayDocumentBar } from '@/components/ScreenplayEditor/ScreenplayDocumentBar'
import '@/styles/screenplayWorkspace.css'
import { FeatureGate } from '@/components/Auth/FeatureGate'

export function ScreenplayView({ projectId }: { projectId: string }) {
  return (
    <ScreenplayShell breadcrumbRightAdornment={<ScreenplayHeaderChrome />}>
      <FeatureGate minTier="spec" variant="page">
        <ScreenplayDocumentBar projectId={projectId} />
        <WritualEditor projectId={projectId} />
      </FeatureGate>
    </ScreenplayShell>
  )
}
