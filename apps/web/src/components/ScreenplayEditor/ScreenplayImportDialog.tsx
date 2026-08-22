'use client'

import * as React from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { request } from 'graphql-request'
import { GRAPHQL_ENDPOINT } from '@/lib/config'
import { useUserProfileStore } from '@/state/user'
import { TIER_RANK, type Tier } from '@/types/tier'
import { PROJECT_IMPORT_ENTITIES_QUERY } from '@/queries/ScreenplayQueries'
import type { ScreenplayDocumentSummary } from '@hooks/useScreenplayDocuments'
import {
  useScreenplayImport,
  type ScreenplayEntityStrategy,
  type ScreenplayPdfImportMode,
  type ScreenplayImportResult,
} from '@hooks/useScreenplayImport'
import { ScreenplayPdfDropZone } from './ScreenplayPdfDropZone'
import {
  ScreenplayImportEntityPicker,
  type ImportEntityOption,
} from './ScreenplayImportEntityPicker'

/** Deriving character and scene cards from a script is a greenlit+ capability. */
const AI_MIN_TIER: Tier = 'greenlit'

interface ScreenplayImportDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  documents: ScreenplayDocumentSummary[]
  /** The tab the writer is on; the default target when replacing. */
  activeDocumentId: string | null
  /** Called with the imported document's id so the caller can switch to its tab. */
  onImported: (result: ScreenplayImportResult) => void
}

/**
 * Import a screenplay PDF into an existing project.
 *
 * The questions asked adapt to what the project already holds:
 *  - a project whose screenplay is still empty imports straight into it, no questions;
 *  - otherwise the writer chooses to replace an existing document or add a new one;
 *  - replacing with card generation on asks whether that rebuilds every character and scene, only
 *    hand-picked ones, or leaves them all alone.
 *
 * Adding always creates the new document's cards fresh, tagged to it, which is what surfaces as a
 * new tab on the characters and outline pages.
 */
export function ScreenplayImportDialog({
  open,
  onClose,
  projectId,
  documents,
  activeDocumentId,
  onImported,
}: ScreenplayImportDialogProps) {
  const tier = useUserProfileStore((s) => (s.userProfile?.tier ?? 'spec') as Tier)
  const aiAvailable = TIER_RANK[tier] >= TIER_RANK[AI_MIN_TIER]

  const documentsWithContent = React.useMemo(
    () => documents.filter((d) => (d.versions?.length ?? 0) > 0),
    [documents],
  )
  const projectHasScreenplay = documentsWithContent.length > 0

  const [file, setFile] = React.useState<File | null>(null)
  const [mode, setMode] = React.useState<ScreenplayPdfImportMode>('replace')
  const [targetDocumentId, setTargetDocumentId] = React.useState<string | null>(null)
  const [documentName, setDocumentName] = React.useState('')
  const [withAi, setWithAi] = React.useState(false)
  const [entityStrategy, setEntityStrategy] =
    React.useState<ScreenplayEntityStrategy>('all')
  const [selectedCharacterIds, setSelectedCharacterIds] = React.useState<string[]>([])
  const [selectedSceneIds, setSelectedSceneIds] = React.useState<string[]>([])

  const { mutate, isPending, error, reset, progressLabel } = useScreenplayImport(projectId)

  // Reset every time the dialog opens so a previous run's answers never carry over.
  React.useEffect(() => {
    if (!open) return
    setFile(null)
    setMode(projectHasScreenplay ? 'replace' : 'replace')
    setTargetDocumentId(activeDocumentId)
    setDocumentName('')
    setWithAi(aiAvailable)
    setEntityStrategy('all')
    setSelectedCharacterIds([])
    setSelectedSceneIds([])
    reset()
  }, [open, projectHasScreenplay, activeDocumentId, aiAvailable, reset])

  const needsEntityPicker =
    mode === 'replace' && withAi && entityStrategy === 'selected'

  const { characterOptions, sceneOptions } = useImportEntityOptions({
    projectId,
    enabled: open && needsEntityPicker,
    documentId: targetDocumentId,
    documents,
  })

  const handleSubmit = React.useCallback(() => {
    if (!file) return
    mutate(
      {
        projectId,
        file,
        mode,
        documentId: targetDocumentId,
        documentName: mode === 'add' ? documentName.trim() || null : null,
        withAi,
        entityStrategy: mode === 'replace' ? entityStrategy : 'all',
        replaceCharacterIds: entityStrategy === 'selected' ? selectedCharacterIds : [],
        replaceSceneIds: entityStrategy === 'selected' ? selectedSceneIds : [],
      },
      {
        onSuccess: (result) => {
          onImported(result)
          onClose()
        },
      },
    )
  }, [
    file,
    mutate,
    projectId,
    mode,
    targetDocumentId,
    documentName,
    withAi,
    entityStrategy,
    selectedCharacterIds,
    selectedSceneIds,
    onImported,
    onClose,
  ])

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import screenplay PDF</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <ScreenplayPdfDropZone
            file={file}
            disabled={isPending}
            onFileSelected={setFile}
            onCleared={() => setFile(null)}
          />

          {file && projectHasScreenplay && (
            <>
              <Divider />
              <FormControl>
                <FormLabel sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight={600} component="span">
                    This project already has a screenplay
                  </Typography>
                </FormLabel>
                <RadioGroup
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ScreenplayPdfImportMode)}
                >
                  <FormControlLabel
                    value="replace"
                    control={<Radio size="small" />}
                    disabled={isPending}
                    label={
                      <OptionLabel
                        title="Replace an existing screenplay"
                        description="Overwrites that document's script with the PDF."
                      />
                    }
                  />
                  <FormControlLabel
                    value="add"
                    control={<Radio size="small" />}
                    disabled={isPending}
                    label={
                      <OptionLabel
                        title="Add as a new screenplay"
                        description="Keeps what you have and adds the PDF as its own document."
                      />
                    }
                  />
                </RadioGroup>
              </FormControl>

              {mode === 'replace' && documents.length > 1 && (
                <FormControl size="small" fullWidth>
                  <FormLabel sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Screenplay to replace
                    </Typography>
                  </FormLabel>
                  <Select
                    value={targetDocumentId ?? ''}
                    disabled={isPending}
                    onChange={(e) => setTargetDocumentId(e.target.value || null)}
                  >
                    {documents.map((doc) => (
                      <MenuItem key={doc._id} value={doc._id}>
                        {doc.name}
                        {doc.isPrimary ? ' (main)' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {mode === 'add' && (
                <TextField
                  size="small"
                  fullWidth
                  label="Name"
                  placeholder={file.name.replace(/\.pdf$/i, '')}
                  helperText="Shown as the tab label on the screenplay, characters and outline pages."
                  value={documentName}
                  disabled={isPending}
                  onChange={(e) => setDocumentName(e.target.value)}
                />
              )}
            </>
          )}

          {file && aiAvailable && (
            <>
              <Divider />
              <FormControlLabel
                control={
                  <Switch
                    checked={withAi}
                    disabled={isPending}
                    onChange={(e) => setWithAi(e.target.checked)}
                  />
                }
                label={
                  <OptionLabel
                    title="Build character and scene cards"
                    description="Reads the script and fills in the characters and outline pages."
                  />
                }
              />
            </>
          )}

          {file && mode === 'replace' && withAi && projectHasScreenplay && (
            <FormControl>
              <FormLabel sx={{ mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={600} component="span">
                  Existing character and scene cards
                </Typography>
              </FormLabel>
              <RadioGroup
                value={entityStrategy}
                onChange={(e) =>
                  setEntityStrategy(e.target.value as ScreenplayEntityStrategy)
                }
              >
                <FormControlLabel
                  value="all"
                  control={<Radio size="small" />}
                  disabled={isPending}
                  label={
                    <OptionLabel
                      title="Replace all"
                      description="Rebuilds this screenplay's cards from the PDF. Locked cards are kept."
                    />
                  }
                />
                <FormControlLabel
                  value="selected"
                  control={<Radio size="small" />}
                  disabled={isPending}
                  label={
                    <OptionLabel
                      title="Replace specific cards"
                      description="Pick which cards to rebuild; the rest stay as they are."
                    />
                  }
                />
                <FormControlLabel
                  value="none"
                  control={<Radio size="small" />}
                  disabled={isPending}
                  label={
                    <OptionLabel
                      title="Keep existing, add what's missing"
                      description="Leaves every card as it is and only adds ones the PDF has that you don't."
                    />
                  }
                />
              </RadioGroup>
            </FormControl>
          )}

          {needsEntityPicker && (
            <ScreenplayImportEntityPicker
              characters={characterOptions}
              scenes={sceneOptions}
              selectedCharacterIds={selectedCharacterIds}
              selectedSceneIds={selectedSceneIds}
              onChangeCharacters={setSelectedCharacterIds}
              onChangeScenes={setSelectedSceneIds}
            />
          )}

          {error && (
            <Alert severity="error" onClose={() => reset()}>
              {error.message}
            </Alert>
          )}

          {isPending && progressLabel && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                {progressLabel}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!file || isPending}>
          {mode === 'add' ? 'Add screenplay' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function OptionLabel({ title, description }: { title: string; description: string }) {
  return (
    <Box>
      <Typography variant="body2">{title}</Typography>
      <Typography variant="caption" color="text.secondary" component="div">
        {description}
      </Typography>
    </Box>
  )
}

/**
 * Existing cards for the document being replaced, shaped for the picker.
 *
 * Cards with no `screenplayDocumentId` predate multi-document support and belong to the primary
 * document by convention, so they are only offered when the primary is the replacement target.
 */
function useImportEntityOptions({
  projectId,
  enabled,
  documentId,
  documents,
}: {
  projectId: string
  enabled: boolean
  documentId: string | null
  documents: ScreenplayDocumentSummary[]
}): { characterOptions: ImportEntityOption[]; sceneOptions: ImportEntityOption[] } {
  const user = useUserProfileStore((s) => s.userProfile?.user)

  const { data } = useQuery({
    queryKey: ['screenplay-import-entities', projectId],
    queryFn: () =>
      request(GRAPHQL_ENDPOINT, PROJECT_IMPORT_ENTITIES_QUERY, {
        input: { user, _id: projectId },
      }),
    enabled: enabled && Boolean(projectId && user),
  }) as { data?: { getProjectData?: Array<Record<string, any>> } }

  return React.useMemo(() => {
    const project = data?.getProjectData?.[0]
    const targetIsPrimary =
      documents.find((d) => d._id === documentId)?.isPrimary ??
      documents.find((d) => d.isPrimary)?._id === documentId

    const belongsToTarget = (entityDocumentId: string | null | undefined) =>
      entityDocumentId != null
        ? entityDocumentId === documentId
        : Boolean(targetIsPrimary)

    const characterOptions: ImportEntityOption[] = (project?.characters ?? [])
      .filter((c: any) => belongsToTarget(c?.screenplayDocumentId))
      .map((c: any) => ({
        id: String(c._id),
        label: (c?.name as string) || 'Untitled character',
        locked: c?.lockedVersion != null,
      }))

    const sceneOptions: ImportEntityOption[] = (project?.scenes ?? [])
      .filter((s: any) => belongsToTarget(s?.screenplayDocumentId))
      .map((s: any, index: number) => {
        const active = s?.activeVersion ?? 1
        const version =
          (s?.versions ?? []).find((v: any) => Number(v?.version) === Number(active)) ??
          (s?.versions ?? [])[0]
        return {
          id: String(s._id),
          label: (version?.sceneHeading as string) || `Scene ${index + 1}`,
          locked: s?.lockedVersion != null,
        }
      })

    return { characterOptions, sceneOptions }
  }, [data, documentId, documents])
}
