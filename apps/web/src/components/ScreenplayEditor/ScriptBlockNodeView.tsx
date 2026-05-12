'use client'

import * as React from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItemButton,
  Popover,
  TextField,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import LayersIcon from '@mui/icons-material/Layers'
import { useUserProfileStore } from '@/state/user'
import { TIER_RANK } from '@/types/tier'
import type { BlockVersion } from './ScreenplayExtension'

function extractText(content: unknown[]): string {
  return (content as Array<{ text?: string }>).map((n) => n.text ?? '').join('').trim()
}

const ELEMENT_TYPES = new Set([
  'action',
  'slugline',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
  'title',
  'author',
  'contact',
])

/** Normalize stored attrs (case, stray values) so data-element-type matches CSS. */
function normalizeElementType(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return ELEMENT_TYPES.has(s) ? s : 'action'
}

export function ScriptBlockNodeView({
  node,
  editor,
  getPos,
  updateAttributes,
}: ReactNodeViewProps) {
  const versions: BlockVersion[] = node.attrs.versions ?? []
  const activeVersionId: string | null = node.attrs.activeVersionId ?? null

  const userTier = useUserProfileStore((s) => s.userProfile?.tier ?? 'spec')
  const isEligible = TIER_RANK[userTier] >= TIER_RANK['indie']

  const [anchorEl, setAnchorElState] = React.useState<HTMLElement | null>(null)
  const popoverAnchorRef = React.useRef<HTMLElement | null>(null)
  const [promotedId, setPromotedId] = React.useState<string | null>(null)
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const promotedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const setAnchorEl = React.useCallback((el: HTMLElement | null) => {
    popoverAnchorRef.current = el
    setAnchorElState(el)
  }, [])

  const popoverOpen = Boolean(anchorEl)
  const elementType = normalizeElementType(node.attrs.elementType)
  const originalVersion = versions.find((v) => v.isOriginal)
  const isShowingAlt = activeVersionId !== null && activeVersionId !== originalVersion?.id

  // First non-active version id — used to set autoFocus when popover opens
  const firstNonActiveId = versions.find((v) => v.id !== activeVersionId)?.id ?? null

  React.useEffect(() => {
    return () => {
      if (promotedTimerRef.current) clearTimeout(promotedTimerRef.current)
    }
  }, [])

  const openPopover = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
  }

  const closePopover = React.useCallback(() => {
    if (promotedId) return
    setAnchorEl(null)
    editor.commands.focus()
  }, [promotedId, setAnchorEl, editor])

  const handlePromote = (versionId: string) => {
    const pos = getPos()
    if (pos === undefined) return
    editor.commands.promoteVersion(pos, versionId)
    setPromotedId(versionId)
    promotedTimerRef.current = setTimeout(() => {
      setPromotedId(null)
      setAnchorEl(null)
      editor.commands.focus()
    }, 1500)
  }

  const handleDelete = (versionId: string) => {
    const pos = getPos()
    if (pos === undefined) return
    editor.commands.deleteBlockVersion(pos, versionId)
    // Close popover if no non-original alts remain after this deletion
    const remaining = versions.filter((v) => !v.isOriginal && v.id !== versionId)
    if (remaining.length === 0) setAnchorEl(null)
  }

  const handleBlur = (event: React.FocusEvent) => {
    // If focus is staying within the NodeView (e.g. user clicked gutter/popover), skip cleanup
    if (event.currentTarget.contains(event.relatedTarget as Node)) return
    // Also skip while popover is open (covers async focus scenarios)
    if (popoverAnchorRef.current !== null) return
    const pos = getPos()
    if (pos === undefined) return
    editor.commands.syncAndCleanMetadata(pos)
  }

  const getPreview = (v: BlockVersion): string => {
    const text = extractText(v.content as unknown[])
    if (text) return text.length > 80 ? text.slice(0, 80) + '…' : text
    if (v.isOriginal || v.label === undefined) return 'Empty Draft...'
    return `${v.label} (Empty)`
  }

  const startRename = (v: BlockVersion) => {
    setRenamingId(v.id)
    setRenameValue(v.label ?? '')
  }

  const commitRename = (versionId: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingId(null)
      return
    }
    const pos = getPos()
    if (pos === undefined) { setRenamingId(null); return }
    // Always fetch live state — never use the closure versions array (may be stale in collab)
    const liveVersions: BlockVersion[] = editor.state.doc.nodeAt(pos)?.attrs.versions || []
    const updatedVersions = liveVersions.map((v: BlockVersion) =>
      v.id === versionId ? { ...v, label: trimmed } : v,
    )
    updateAttributes({ versions: updatedVersions })
    setRenamingId(null)
  }

  return (
    <NodeViewWrapper
      as="div"
      data-script-block="true"
      data-element-type={elementType}
      className="script-block"
      style={{ position: 'relative' }}
      onBlur={handleBlur}
    >
      {versions.length > 0 && isEligible && (
        <Box
          component="span"
          className={`script-block-alts-indicator${popoverOpen ? ' popover-open' : ''}`}
          sx={{ textTransform: 'none' }}
        >
          <IconButton size="small" onClick={openPopover} aria-label="View alts">
            <LayersIcon
              sx={{
                fontSize: 14,
                color: isShowingAlt ? 'primary.main' : 'text.secondary',
              }}
            />
            <Typography variant="caption" sx={{ ml: 0.25 }}>
              {versions.length}
            </Typography>
          </IconButton>
        </Box>
      )}

      <NodeViewContent as="div" />

      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={promotedId ? () => {} : closePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        disablePortal
      >
        <List dense sx={{ minWidth: 280, maxWidth: 360 }}>
          {versions.map((v) => {
            const isActive = v.id === activeVersionId
            const isPromotedItem = promotedId === v.id
            const preview = getPreview(v)
            const isEmpty = extractText(v.content as unknown[]) === ''

            return (
              <ListItemButton
                key={v.id}
                selected={isActive}
                disabled={!!promotedId}
                // autoFocus on the first non-active row so keyboard users can tab through immediately
                autoFocus={v.id === firstNonActiveId}
                sx={{ flexDirection: 'column', alignItems: 'flex-start', px: 2, py: 1, gap: 0.5 }}
              >
                {/* Header row: label + rename + delete */}
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0.5 }}>
                  {v.isOriginal ? (
                    <Chip label="Original" size="small" />
                  ) : renamingId === v.id ? (
                    <TextField
                      size="small"
                      value={renameValue}
                      autoFocus
                      disabled={!!promotedId}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(v.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitRename(v.id)
                        }
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ flex: 1 }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <Typography variant="body2">{v.label ?? '(Unlabeled)'}</Typography>
                      <IconButton
                        size="small"
                        aria-label="Rename this version"
                        disabled={!!promotedId}
                        onClick={(e) => {
                          e.stopPropagation()
                          startRename(v)
                        }}
                      >
                        <EditIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                  )}

                  {!v.isOriginal && (
                    <IconButton
                      size="small"
                      aria-label="Delete this version"
                      disabled={!!promotedId}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(v.id)
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  )}
                </Box>

                {/* Preview */}
                <Typography
                  variant="caption"
                  color={isEmpty ? 'text.disabled' : 'text.secondary'}
                  sx={{ fontStyle: isEmpty ? 'italic' : 'normal' }}
                >
                  {preview}
                </Typography>

                {/* Attribution */}
                <Typography variant="caption" color="text.disabled">
                  {v.authorId !== 'initial' ? v.authorId : 'Original'} ·{' '}
                  {new Date(v.timestamp).toLocaleString()}
                </Typography>

                {/* Promote button */}
                <Button
                  size="small"
                  variant={isActive ? 'contained' : 'outlined'}
                  disabled={isActive || !!promotedId}
                  aria-label="Promote this version to main script"
                  startIcon={isPromotedItem ? <CheckCircleIcon /> : undefined}
                  color={isPromotedItem ? 'success' : 'primary'}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePromote(v.id)
                  }}
                  sx={{ mt: 0.5 }}
                >
                  {isPromotedItem ? 'Promoted!' : 'Make Primary'}
                </Button>
              </ListItemButton>
            )
          })}
        </List>
      </Popover>
    </NodeViewWrapper>
  )
}
