'use client'

import * as React from 'react'
import { Alert, Box, Button, Snackbar } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useScreenplayDocuments } from '@hooks/useScreenplayDocuments'
import { useScreenplayDocumentsStore } from '@/state/screenplayDocuments'
import { useUserProfileStore } from '@/state/user'
import { ScreenplayDocumentTabs } from './ScreenplayDocumentTabs'
import { ScreenplayImportDialog } from './ScreenplayImportDialog'
import { ScreenplayDocumentActions } from './ScreenplayDocumentActions'
import { NewScreenplayDocumentButton } from './NewScreenplayDocumentButton'
import type { ScreenplayImportResult } from '@hooks/useScreenplayImport'

interface ScreenplayDocumentBarProps {
  projectId: string
}

/**
 * Document tabs plus the "Import PDF" entry point, sitting above the screenplay editor.
 *
 * Import is offered to anyone who can edit the project; whether it also builds character and scene
 * cards is a separate, tier-gated choice made inside the dialog. Adding a screenplay alongside the
 * ones already there — blank, or copied from one of the project's scripts — is greenlit+; see
 * NewScreenplayDocumentButton.
 */
export function ScreenplayDocumentBar({ projectId }: ScreenplayDocumentBarProps) {
  const { documents, projectTitle, activeDocument, activeDocumentId, setActiveDocumentId } =
    useScreenplayDocuments(projectId)
  const user = useUserProfileStore((s) => s.userProfile?.user)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [errorNotice, setErrorNotice] = React.useState<string | null>(null)
  const publishImportedContent = useScreenplayDocumentsStore((s) => s.publishImportedContent)

  const handleImported = React.useCallback(
    (result: ScreenplayImportResult) => {
      // Land the writer on whatever the import produced — a brand new tab for "add", or the
      // document they chose to replace.
      if (result.documentId) setActiveDocumentId(result.documentId)

      // Adding a document switches tabs, which remounts the editor against a fresh Yjs document and
      // seeds it from the server. Replacing does neither — the selected document is unchanged — so
      // the mounted editor has to be handed the new script explicitly.
      if (!result.isNewDocument && result.documentId) {
        publishImportedContent(projectId, result.documentId, result.doc)
      }

      setNotice(summarizeImport(result))
    },
    [projectId, setActiveDocumentId, publishImportedContent],
  )

  if (!user) return null

  return (
    <>
      <Box sx={{ px: 1.5, pt: 0.5, flexShrink: 0 }}>
        <ScreenplayDocumentTabs
          documents={documents}
          activeDocumentId={activeDocumentId}
          onChange={setActiveDocumentId}
          rightAdornment={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <NewScreenplayDocumentButton
                projectId={projectId}
                defaultName={`Screenplay ${documents.length + 1}`}
                documents={documents}
                activeDocumentId={activeDocumentId}
                projectTitle={projectTitle}
                onCreated={setActiveDocumentId}
                onError={setErrorNotice}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => setDialogOpen(true)}
              >
                Import PDF
              </Button>
              <ScreenplayDocumentActions
                projectId={projectId}
                document={activeDocument}
                canDelete={documents.length > 1}
                onDeleted={() => {
                  // Fall back to the primary; the tab that was selected no longer exists.
                  const next = documents.find(
                    (d) => d._id !== activeDocumentId && d.isPrimary,
                  )
                  if (next) setActiveDocumentId(next._id)
                }}
                onError={setErrorNotice}
              />
            </Box>
          }
        />
      </Box>

      <ScreenplayImportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={projectId}
        documents={documents}
        activeDocumentId={activeDocumentId}
        onImported={handleImported}
      />

      <Snackbar
        open={notice != null}
        autoHideDuration={8000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setNotice(null)} variant="filled">
          {notice}
        </Alert>
      </Snackbar>

      <Snackbar
        open={errorNotice != null}
        autoHideDuration={8000}
        onClose={() => setErrorNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorNotice(null)} variant="filled">
          {errorNotice}
        </Alert>
      </Snackbar>
    </>
  )
}

function summarizeImport(result: ScreenplayImportResult): string {
  const parts: string[] = [
    result.isNewDocument
      ? `Added "${result.documentName}".`
      : `Replaced "${result.documentName}".`,
  ]
  if (result.charactersCreated > 0 || result.scenesCreated > 0) {
    parts.push(
      `Created ${result.charactersCreated} character${result.charactersCreated === 1 ? '' : 's'} and ${result.scenesCreated} scene${result.scenesCreated === 1 ? '' : 's'}.`,
    )
  }
  if (result.entityErrors?.length > 0) {
    parts.push(`${result.entityErrors.length} item(s) needed attention.`)
  }
  return parts.join(' ')
}
