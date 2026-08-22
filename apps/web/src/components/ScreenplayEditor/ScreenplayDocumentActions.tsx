'use client'

import * as React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authRequest } from '@/lib/authRequest'
import {
  DELETE_SCREENPLAY_DOCUMENT,
  RENAME_SCREENPLAY_DOCUMENT,
} from '@mutations/ScreenplayMutations'
import { PROJECT_SCENES_QUERY_KEY } from '@hooks/useProjectSceneMutations'
import {
  SCREENPLAY_DOCUMENT_QUERY_KEY,
  SCREENPLAY_DOCUMENTS_QUERY_KEY,
  type ScreenplayDocumentSummary,
} from '@hooks/useScreenplayDocuments'

interface ScreenplayDocumentActionsProps {
  projectId: string
  document: ScreenplayDocumentSummary | null
  /** Deleting the last document is refused server-side; hide the option rather than fail. */
  canDelete: boolean
  onDeleted: () => void
  onError: (message: string) => void
}

/**
 * Rename and delete for the screenplay document currently in view.
 *
 * Deleting also removes the character and scene cards derived from that document — the same cards
 * its tab shows on the characters and outline pages — so the confirmation says so plainly.
 */
export function ScreenplayDocumentActions({
  projectId,
  document,
  canDelete,
  onDeleted,
  onError,
}: ScreenplayDocumentActionsProps) {
  const queryClient = useQueryClient()
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [name, setName] = React.useState('')

  const invalidate = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [SCREENPLAY_DOCUMENTS_QUERY_KEY, projectId] }),
      queryClient.invalidateQueries({ queryKey: [SCREENPLAY_DOCUMENT_QUERY_KEY, projectId] }),
      queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, projectId] }),
      queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] }),
    ])
  }, [queryClient, projectId])

  const renameMutation = useMutation({
    mutationFn: async (nextName: string) =>
      authRequest(RENAME_SCREENPLAY_DOCUMENT, {
        projectId,
        documentId: document?._id,
        name: nextName,
      }),
    onSuccess: async () => {
      setRenameOpen(false)
      await invalidate()
    },
    onError: (e: Error) => onError(e.message || 'Could not rename the screenplay.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () =>
      authRequest<{ deleteScreenplayDocument?: { deleted: boolean; reason?: string } }>(
        DELETE_SCREENPLAY_DOCUMENT,
        { projectId, documentId: document?._id },
      ),
    onSuccess: async (result) => {
      setDeleteOpen(false)
      if (result?.deleteScreenplayDocument?.deleted === false) {
        onError(result.deleteScreenplayDocument.reason ?? 'Could not delete the screenplay.')
        return
      }
      onDeleted()
      await invalidate()
    },
    onError: (e: Error) => onError(e.message || 'Could not delete the screenplay.'),
  })

  if (!document) return null

  return (
    <>
      <Tooltip title="Screenplay options">
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="screenplay document options"
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={anchorEl != null} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setName(document.name)
            setRenameOpen(true)
            setAnchorEl(null)
          }}
        >
          Rename
        </MenuItem>
        {canDelete && (
          <MenuItem
            onClick={() => {
              setDeleteOpen(true)
              setAnchorEl(null)
            }}
          >
            Delete
          </MenuItem>
        )}
      </Menu>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename screenplay</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            margin="dense"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={name.trim() === '' || renameMutation.isPending}
            onClick={() => renameMutation.mutate(name.trim())}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete &quot;{document.name}&quot;?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes the script along with the character and scene cards on its tab.
            The rest of the project is untouched. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
