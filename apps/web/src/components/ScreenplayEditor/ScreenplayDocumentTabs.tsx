'use client'

import * as React from 'react'
import { Box, Tab, Tabs, Tooltip } from '@mui/material'
import type { ScreenplayDocumentSummary } from '@hooks/useScreenplayDocuments'

interface ScreenplayDocumentTabsProps {
  documents: ScreenplayDocumentSummary[]
  activeDocumentId: string | null
  onChange: (documentId: string) => void
  /** Rendered to the right of the tabs — the import button on the screenplay page. */
  rightAdornment?: React.ReactNode
}

/**
 * Tab strip for a project's screenplay documents, shared by the screenplay, characters and outline
 * pages so all three switch together.
 *
 * A project with a single document shows no tabs — there is nothing to choose between, and an
 * always-present one-tab strip would just cost vertical space in the editor. The right adornment
 * still renders, so the import action stays reachable.
 */
export function ScreenplayDocumentTabs({
  documents,
  activeDocumentId,
  onChange,
  rightAdornment,
}: ScreenplayDocumentTabsProps) {
  const showTabs = documents.length > 1
  if (!showTabs && !rightAdornment) return null

  // MUI warns (and renders nothing selected) if `value` names no tab, which happens for the moment
  // between deleting the active document and the list refetching.
  const value =
    activeDocumentId && documents.some((d) => d._id === activeDocumentId)
      ? activeDocumentId
      : documents[0]?._id ?? false

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        width: '100%',
        minHeight: 40,
        flexShrink: 0,
      }}
    >
      {showTabs ? (
        <Tabs
          value={value}
          onChange={(_, next: string) => onChange(next)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none' } }}
        >
          {documents.map((doc) => (
            <Tab
              key={doc._id}
              value={doc._id}
              label={
                <Tooltip title={doc.sourceFileName ?? doc.name} enterDelay={600}>
                  <span>{doc.name}</span>
                </Tooltip>
              }
            />
          ))}
        </Tabs>
      ) : (
        <Box />
      )}
      {rightAdornment}
    </Box>
  )
}
