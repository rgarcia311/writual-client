'use client'

import * as React from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authRequest } from '@/lib/authRequest'
import { FeatureGate } from '@/components/Auth/FeatureGate'
import { MULTI_SCREENPLAY_MIN_TIER } from '@/types/tier'
import { CREATE_SCREENPLAY_DOCUMENT } from '@mutations/ScreenplayMutations'
import { SCREENPLAY_DOCUMENT_QUERY } from '@/queries/ScreenplayQueries'
import {
  SCREENPLAY_DOCUMENTS_QUERY_KEY,
  type ScreenplayDocumentSummary,
} from '@hooks/useScreenplayDocuments'
import { useUserProfileStore } from '@/state/user'
import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints'
import { buildBlankDoc, buildTitlePageBlocks } from './screenplaySeedDoc'

/** Blank page, or a duplicate of a script the project already holds. */
type NewScreenplayMode = 'blank' | 'copy'

interface NewScreenplayDocumentButtonProps {
  projectId: string
  /** Fallback name for the next document, e.g. "Screenplay 2", shown as the field's placeholder. */
  defaultName: string
  /** The project's screenplays — the copy source list, and how the tabs are already named. */
  documents: ScreenplayDocumentSummary[]
  /** Pre-selected copy source: the tab the writer is looking at. */
  activeDocumentId: string | null
  /** Goes on the new screenplay's title page, as it does on the project's first one. */
  projectTitle: string | null
  /** Called with the new document's id so the caller can switch to its tab. */
  onCreated: (documentId: string) => void
  onError: (message: string) => void
}

/** A document with no saved script cannot be copied — there is nothing in it yet to copy. */
function isCopyable(document: ScreenplayDocumentSummary): boolean {
  return (document.versions?.length ?? 0) > 0
}

/**
 * Adds a second (third, …) screenplay document to the project — blank, or a copy of one of the
 * project's existing scripts.
 *
 * The new document arrives as its own tab on the screenplay page and, because character and scene
 * cards are tagged with the document they belong to, as a matching tab on the characters and
 * outline pages — so a writer can keep a second draft's cast and outline apart from the first's.
 * Copying takes the script only, for that reason: the cards stay with the document they were
 * derived from.
 *
 * Either way the new document is created *with* content, which is also what stops the editor from
 * seeding it: an empty document opened in the editor gets the project's outline poured into it as
 * scene headings, which is the opposite of what someone asking for a blank screenplay wants.
 *
 * Gated at greenlit to match the API: `createScreenplayDocument` refuses below that tier once the
 * project already has a document.
 */
export function NewScreenplayDocumentButton({
  projectId,
  defaultName,
  documents,
  activeDocumentId,
  projectTitle,
  onCreated,
  onError,
}: NewScreenplayDocumentButtonProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<NewScreenplayMode>('blank')
  const [sourceId, setSourceId] = React.useState<string>('')
  const [name, setName] = React.useState('')

  const userDisplayName = useUserProfileStore((s) => s.userProfile?.displayName)
  const userName = useUserProfileStore((s) => s.userProfile?.name)
  const userEmail = useUserProfileStore((s) => s.userProfile?.email)

  const copyableDocuments = React.useMemo(() => documents.filter(isCopyable), [documents])
  const canCopy = copyableDocuments.length > 0
  const source = documents.find((d) => d._id === sourceId) ?? null

  /** What the tab is called when the writer leaves the name field empty. */
  const fallbackName =
    mode === 'copy' && source ? `${source.name} copy` : defaultName

  const createMutation = useMutation({
    mutationFn: async () => {
      const documentName = name.trim() || fallbackName

      if (mode === 'copy') {
        if (!source) throw new Error('Choose a screenplay to copy.')
        // Fetched here rather than held in the tab list: the list is metadata-only precisely so a
        // project holding several feature scripts doesn't ship all of them on every page load.
        const read = await authRequest<{
          getScreenplayDocument?: {
            layout?: unknown
            pageCount?: number | null
            versions?: Array<{ content?: unknown }>
          }
        }>(SCREENPLAY_DOCUMENT_QUERY, { projectId, documentId: source._id })

        const original = read?.getScreenplayDocument
        const content = original?.versions?.[0]?.content ?? null
        if (content == null) {
          throw new Error(`"${source.name}" has no saved script to copy yet.`)
        }

        return authRequest<{ createScreenplayDocument?: { _id: string } }>(
          CREATE_SCREENPLAY_DOCUMENT,
          {
            projectId,
            name: documentName,
            content,
            layout: original?.layout ?? null,
            pageCount: original?.pageCount ?? null,
            // Kept so a copy of an imported script still says where the script came from.
            sourceFileName: source.sourceFileName ?? null,
          },
        )
      }

      const blankDoc = buildBlankDoc(
        buildTitlePageBlocks(projectTitle, userDisplayName, userName, userEmail),
      )
      return authRequest<{ createScreenplayDocument?: { _id: string } }>(
        CREATE_SCREENPLAY_DOCUMENT,
        { projectId, name: documentName, content: blankDoc },
      )
    },
    onSuccess: async (result) => {
      setOpen(false)
      // The tab strips on all three pages read this query, so it has to settle before the caller
      // selects the new tab — otherwise the selection names a document the list does not have yet
      // and falls back to the primary.
      await queryClient.invalidateQueries({
        queryKey: [SCREENPLAY_DOCUMENTS_QUERY_KEY, projectId],
      })
      const documentId = result?.createScreenplayDocument?._id
      if (documentId) onCreated(documentId)
    },
    onError: (e: Error) => onError(e.message || 'Could not add a screenplay.'),
  })

  const handleOpen = () => {
    // Empty, not pre-filled: this document is the writer's to name, and the fallback above still
    // stands in (as placeholder here) if they leave it blank.
    setName('')
    setMode('blank')
    // The tab they are on is the one they most likely mean to copy; anything unsaved cannot be.
    const preferred = copyableDocuments.find((d) => d._id === activeDocumentId)
    setSourceId((preferred ?? copyableDocuments[0])?._id ?? '')
    setOpen(true)
  }

  return (
    <>
      <FeatureGate minTier={MULTI_SCREENPLAY_MIN_TIER}>
        <Button
          size="small"
          variant="outlined"
          aria-label="New screenplay"
          startIcon={<NoteAddIcon />}
          onClick={handleOpen}
          sx={{
            // The bar also carries Import PDF and the options menu; on a phone the labels crowd
            // out the tab strip, so this one collapses to its icon. CSS rather than useIsMobile so
            // there is no post-hydration flip.
            [`@media ${MOBILE_MEDIA_QUERY}`]: {
              minWidth: 0,
              px: 1,
              '& .MuiButton-startIcon': { mr: 0, ml: 0 },
              '& .new-screenplay-label': { display: 'none' },
            },
          }}
        >
          <Box component="span" className="new-screenplay-label">
            New screenplay
          </Box>
        </Button>
      </FeatureGate>

      <Dialog
        open={open}
        onClose={createMutation.isPending ? undefined : () => setOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add a screenplay</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }} variant="body2">
            The new screenplay gets its own tab here and on the characters and outline pages, so its
            cast and scenes stay separate from your other drafts.
          </DialogContentText>

          <FormControl disabled={createMutation.isPending}>
            <FormLabel id="new-screenplay-mode-label" sx={{ fontSize: '0.8rem' }}>
              Start from
            </FormLabel>
            <RadioGroup
              aria-labelledby="new-screenplay-mode-label"
              value={mode}
              onChange={(e) => setMode(e.target.value as NewScreenplayMode)}
            >
              <FormControlLabel
                value="blank"
                control={<Radio size="small" />}
                label="A blank screenplay"
              />
              <FormControlLabel
                value="copy"
                control={<Radio size="small" />}
                disabled={!canCopy}
                label={
                  canCopy
                    ? 'A copy of an existing screenplay'
                    : 'A copy of an existing screenplay (none saved yet)'
                }
              />
            </RadioGroup>
          </FormControl>

          {mode === 'copy' ? (
            <TextField
              select
              fullWidth
              size="small"
              margin="dense"
              label="Copy from"
              value={sourceId}
              disabled={createMutation.isPending}
              onChange={(e) => setSourceId(e.target.value)}
              helperText="Copies the script itself. Character and scene cards stay with the original."
            >
              {documents.map((document) => (
                <MenuItem key={document._id} value={document._id} disabled={!isCopyable(document)}>
                  {isCopyable(document) ? document.name : `${document.name} (empty)`}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <TextField
            autoFocus
            fullWidth
            size="small"
            margin="dense"
            label="Name"
            placeholder={fallbackName}
            value={name}
            disabled={createMutation.isPending}
            onChange={(e) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending || (mode === 'copy' && !source)}
            onClick={() => createMutation.mutate()}
          >
            Add screenplay
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
