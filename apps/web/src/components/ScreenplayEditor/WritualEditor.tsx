'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { CollaborationCursor } from './CollaborationCursorExtension'
import { useQuery } from '@tanstack/react-query'
import { request } from 'graphql-request'
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'
import PersonIcon from '@mui/icons-material/Person'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import NotesIcon from '@mui/icons-material/Notes'
import FastForwardIcon from '@mui/icons-material/FastForward'

import {
  ScriptBlock,
  SCREENPLAY_ELEMENT_LABELS,
  type ScreenplayElementType,
} from './ScreenplayExtension'
import { PageBreakExtension } from './PageBreakPlugin'
import { printScreenplayHidden } from './screenplayPdfPrint'
import { BlockAltsToolbar } from './BlockAltsToolbar'
import {
  ScreenplayDocumentToolbar,
  SCREENPLAY_ZOOM_MAX,
  SCREENPLAY_ZOOM_MIN,
  SCREENPLAY_ZOOM_STEP,
} from './ScreenplayDocumentToolbar'
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries'
import { PROJECT_SCENES_QUERY_KEY } from 'hooks'
import { useAutosave } from '@hooks/useAutosave'
import { useCollaboration } from '@hooks/useCollaboration'
import { useUserProfileStore } from '@/state/user'
import { useScreenplaySaveStatusStore } from '@/state/screenplaySaveStatus'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { useScreenplayHeaderChromeStore } from '@/state/screenplayHeaderChrome'
import { GRAPHQL_ENDPOINT } from '@/lib/config'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import type * as Y from 'yjs'
import './Screenplay.css'
import {
  SCREENPLAY_EDITOR_COLUMN_WIDTH_PX,
  SCREENPLAY_PAPER_HEIGHT_PX,
  SCREENPLAY_PAPER_WIDTH_PX,
  SCREENPLAY_SCROLL_GUTTER_LEFT_PX,
  SCREENPLAY_SCROLL_GUTTER_RIGHT_PX,
} from './screenplayPaperLayout'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SceneVersion {
  sceneHeading?: string
  version?: number
}

interface ProjectScene {
  _id: string
  activeVersion?: number
  versions?: SceneVersion[]
}

// ─── Element icon map ─────────────────────────────────────────────────────────

export const ELEMENT_ICONS: Record<ScreenplayElementType, React.ReactNode> = {
  slugline:      <LocalMoviesIcon sx={{ fontSize: 14 }} />,
  action:        <NotesIcon sx={{ fontSize: 14 }} />,
  character:     <PersonIcon sx={{ fontSize: 14 }} />,
  parenthetical: <FormatQuoteIcon sx={{ fontSize: 14 }} />,
  dialogue:      <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />,
  transition:    <FastForwardIcon sx={{ fontSize: 14 }} />,
}

export const ELEMENT_ORDER: ScreenplayElementType[] = [
  'slugline',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
]

/**
 * Keyboard shortcut hints shown in each toolbar toggle button tooltip.
 * Tab cycles: action(1) → slugline(2) → character(3) → parenthetical(4) → dialogue(5)
 * Enter: character→dialogue · parenthetical→dialogue · dialogue→action · slugline→action
 */
export const ELEMENT_SHORTCUTS: Record<ScreenplayElementType, string> = {
  slugline:      'Tab ×2 from Action',
  action:        'Tab ×1  ·  Enter after Dialogue or Scene Heading',
  character:     'Tab ×3 from Action',
  parenthetical: 'Tab ×4  ·  Enter after Character',
  dialogue:      'Tab ×5  ·  Enter after Character or Parenthetical',
  transition:    'Click to set  (not in Tab cycle)',
}

// ─── Tooltip content component ────────────────────────────────────────────────

export function ElementTooltipContent({ type }: { type: ScreenplayElementType }) {
  return (
    <Box sx={{ p: 0.25 }}>
      <Typography variant="caption" fontWeight={700} display="block">
        {SCREENPLAY_ELEMENT_LABELS[type]}
      </Typography>
      <Typography variant="caption" display="block" sx={{ opacity: 0.75, mt: 0.25 }}>
        {ELEMENT_SHORTCUTS[type]}
      </Typography>
    </Box>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSceneHeading(scene: ProjectScene): string {
  const idx = Math.max(0, (scene.activeVersion ?? 1) - 1)
  return (scene.versions?.[idx]?.sceneHeading ?? '').trim()
}

/** Build a TipTap doc seeded with scene headings from the outline. */
function buildDocFromScenes(scenes: ProjectScene[]): Record<string, unknown> {
  const blocks = scenes.flatMap((scene) => {
    const heading = getSceneHeading(scene).toUpperCase()
    return [
      {
        type: 'scriptBlock',
        attrs: { elementType: 'slugline' },
        content: heading ? [{ type: 'text', text: heading }] : [],
      },
      {
        type: 'scriptBlock',
        attrs: { elementType: 'action' },
        content: [],
      },
    ]
  })
  return { type: 'doc', content: blocks }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WritualEditorProps {
  projectId?: string
}

// ─── Outer Component — data fetch + permission gate ───────────────────────────

export function WritualEditor({ projectId }: WritualEditorProps) {
  const user = useUserProfileStore((s) => s.userProfile?.user)

  const { data: scenesData, isLoading: scenesLoading } = useQuery({
    queryKey: [PROJECT_SCENES_QUERY_KEY, projectId],
    queryFn: async () =>
      request(GRAPHQL_ENDPOINT, PROJECT_SCENES_QUERY, {
        input: { user, _id: projectId },
      }),
    enabled: Boolean(projectId && user),
  }) as { data: any; isLoading: boolean }

  const project = (scenesData as any)?.getProjectData?.[0]
  const projectScenes: ProjectScene[] = project?.scenes ?? []
  const savedScreenplayContent = project?.screenplay?.versions?.[0]?.content ?? null

  const canEdit = React.useMemo(() => {
    if (!project || !user) return false
    if (project.user === user) return true
    if (project.sharedWith?.includes(user)) return true
    return project.collaborators?.some(
      (c: any) => c.uid === user && c.status === 'active' && c.permissionLevel === 'edit'
    ) ?? false
  }, [project, user])

  if (scenesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <CollabGate
      projectId={projectId}
      canEdit={canEdit}
      projectScenes={projectScenes}
      savedScreenplayContent={savedScreenplayContent}
    />
  )
}

// ─── Middle Layer — collab resource gate ───────────────────────────────────────

interface CollabGateProps {
  projectId?: string
  canEdit: boolean
  projectScenes: ProjectScene[]
  savedScreenplayContent: unknown
}

function CollabGate({ projectId, canEdit, projectScenes, savedScreenplayContent }: CollabGateProps) {
  const { ydoc, provider, failed } = useCollaboration(projectId)

  if (projectId && !failed && (!ydoc || !provider)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <ScreenplayEditorCore
      key={`${projectId}-${failed ? 'solo' : 'collab'}`}
      projectId={projectId}
      canEdit={canEdit}
      projectScenes={projectScenes}
      savedScreenplayContent={savedScreenplayContent}
      ydoc={failed ? null : ydoc}
      provider={failed ? null : provider}
    />
  )
}

// ─── Inner Component — Tiptap editor with stable extensions ───────────────────

interface ScreenplayEditorCoreProps {
  projectId?: string
  canEdit: boolean
  projectScenes: ProjectScene[]
  savedScreenplayContent: unknown
  ydoc: Y.Doc | null
  provider: HocuspocusProvider | null
}

function ScreenplayEditorCore({
  projectId,
  canEdit,
  projectScenes,
  savedScreenplayContent,
  ydoc,
  provider,
}: ScreenplayEditorCoreProps) {
  const theme = useTheme()
  const [navigatorOpen, setNavigatorOpen] = React.useState(true)
  const [zoom, setZoom] = React.useState(1)

  const workspaceRef = React.useRef<HTMLDivElement | null>(null)
  const stageRef = React.useRef<HTMLDivElement | null>(null)
  const pageRef = React.useRef<HTMLDivElement | null>(null)
  const toolbarScaleStageRef = React.useRef<HTMLDivElement | null>(null)
  const toolbarScaleInnerRef = React.useRef<HTMLDivElement | null>(null)
  const paperLayoutRef = React.useRef({
    width: SCREENPLAY_PAPER_WIDTH_PX,
    height: SCREENPLAY_PAPER_HEIGHT_PX,
  })
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom

  const applyStageDimensions = React.useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const z = zoomRef.current
    const { width, height } = paperLayoutRef.current
    stage.style.width = `${width * z}px`
    stage.style.height = `${height * z}px`
  }, [])

  React.useLayoutEffect(() => {
    applyStageDimensions()
  }, [zoom, applyStageDimensions])

  const syncToolbarScaleLayout = React.useCallback(() => {
    const stage = toolbarScaleStageRef.current
    const inner = toolbarScaleInnerRef.current
    if (!stage || !inner) return
    const z = zoomRef.current
    stage.style.width = `${SCREENPLAY_PAPER_WIDTH_PX * z}px`
    stage.style.height = `${inner.offsetHeight * z}px`
  }, [])

  React.useLayoutEffect(() => {
    syncToolbarScaleLayout()
  }, [zoom, syncToolbarScaleLayout])

  React.useEffect(() => {
    const inner = toolbarScaleInnerRef.current
    if (!inner) return
    const ro = new ResizeObserver(() => {
      syncToolbarScaleLayout()
    })
    ro.observe(inner)
    return () => {
      ro.disconnect()
    }
  }, [syncToolbarScaleLayout])

  React.useEffect(() => {
    const page = pageRef.current
    if (!page) return
    const ro = new ResizeObserver(() => {
      paperLayoutRef.current = {
        width: SCREENPLAY_PAPER_WIDTH_PX,
        height: page.offsetHeight,
      }
      applyStageDimensions()
    })
    ro.observe(page)
    return () => {
      ro.disconnect()
    }
  }, [applyStageDimensions])

  React.useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -SCREENPLAY_ZOOM_STEP : SCREENPLAY_ZOOM_STEP
      setZoom((z) => {
        const next = Math.min(
          SCREENPLAY_ZOOM_MAX,
          Math.max(SCREENPLAY_ZOOM_MIN, Math.round((z + delta) * 100) / 100),
        )
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const { setActiveType, setCanEdit, setElementTypeFnRef } = useScreenplayEditorStore()

  const seededRef = React.useRef(false)

  const user = useUserProfileStore((s) => s.userProfile?.user)

  // ── Save status ──────────────────────────────────────────────────────────
  const { savingCount, lastSavedAt, hasPendingChanges, setPending, startSaving, endSaving } = useScreenplaySaveStatusStore()
  const isSavingOrPending = hasPendingChanges || savingCount > 0
  const showSaved = !isSavingOrPending && lastSavedAt != null

  // ── Collaboration state ─────────────────────────────────────────────────
  const collabActive = ydoc != null && provider != null

  // ── Extensions — stable from first render ───────────────────────────────
  const extensions = React.useMemo(() => {
    const base: ReturnType<typeof StarterKit.configure>[] = [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        strike: false,
        link: false,
        horizontalRule: false,
        hardBreak: false,
        trailingNode: false,
        undoRedo: collabActive ? false : undefined,
      }),
      ScriptBlock as any,
      PageBreakExtension,
    ]

    if (collabActive) {
      base.push(Collaboration.configure({ document: ydoc }) as any)

      if (canEdit) {
        base.push(
          CollaborationCursor.configure({ provider }) as any,
        )
      }
    }

    return base
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Editor ───────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions,
    content: collabActive
      ? undefined
      : {
          type: 'doc',
          content: [{ type: 'scriptBlock', attrs: { elementType: 'action' }, content: [] }],
        },
    autofocus: 'end',
    immediatelyRender: false,
    editable: canEdit,
  })

  // ── Sync editable state ──────────────────────────────────────────────────
  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(canEdit)
  }, [editor, canEdit])

  // ── Sync canEdit to store ─────────────────────────────────────────────────
  React.useEffect(() => {
    setCanEdit(canEdit)
  }, [canEdit, setCanEdit])

  // ── Register element-type command with store; clear on unmount ────────────
  React.useEffect(() => {
    if (!editor) return
    setElementTypeFnRef((type) => editor.chain().focus().setElementType(type).run())
    return () => setElementTypeFnRef(null)
  }, [editor, setElementTypeFnRef])

  // ── Seed legacy content into empty Yjs doc on first sync ─────────────────
  React.useEffect(() => {
    if (!editor || !provider || !collabActive || seededRef.current) return

    const handleSynced = () => {
      if (seededRef.current) return
      seededRef.current = true

      if (editor.isEmpty) {
        const legacyContent = savedScreenplayContent || (
          projectScenes.length
            ? buildDocFromScenes(projectScenes)
            : {
                type: 'doc',
                content: [
                  {
                    type: 'scriptBlock',
                    attrs: { elementType: 'slugline' },
                    content: [{ type: 'text', text: 'INT. YOUR SCENE - DAY' }],
                  },
                  {
                    type: 'scriptBlock',
                    attrs: { elementType: 'action' },
                    content: [
                      {
                        type: 'text',
                        text: 'Add scenes in the Outline tab to pre-populate scene headings here.',
                      },
                    ],
                  },
                ],
              }
        )
        editor.commands.setContent(legacyContent)
      }
    }

    provider.on('synced', handleSynced)
    return () => { provider.off('synced', handleSynced) }
  }, [editor, provider, collabActive, savedScreenplayContent, projectScenes])

  // ── Non-collab seeding (standalone mode) ─────────────────────────────────
  React.useEffect(() => {
    if (!editor || seededRef.current || collabActive) return
    seededRef.current = true

    if (savedScreenplayContent) {
      queueMicrotask(() => editor.commands.setContent(savedScreenplayContent))
      return
    }

    const doc = projectScenes.length
      ? buildDocFromScenes(projectScenes)
      : {
          type: 'doc',
          content: [
            {
              type: 'scriptBlock',
              attrs: { elementType: 'slugline' },
              content: [{ type: 'text', text: 'INT. YOUR SCENE - DAY' }],
            },
            {
              type: 'scriptBlock',
              attrs: { elementType: 'action' },
              content: [
                {
                  type: 'text',
                  text: 'Add scenes in the Outline tab to pre-populate scene headings here.',
                },
              ],
            },
          ],
        }

    queueMicrotask(() => editor.commands.setContent(doc))
  }, [editor, projectScenes, savedScreenplayContent, collabActive])

  // ── Autosave (disabled when collab is active) ────────────────────────────
  useAutosave(editor, projectId, {
    enabled: canEdit && !collabActive,
    onPending: () => setPending(true),
    onSaveStart: startSaving,
    onSaveEnd: endSaving,
  })

  // ── Sync active element type on selection/content change ─────────────────
  React.useEffect(() => {
    if (!editor) return
    const syncType = () => {
      const { $from } = editor.state.selection
      let found = false
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth)
        if (node.type.name === 'scriptBlock') {
          setActiveType((node.attrs.elementType as ScreenplayElementType) ?? 'action')
          found = true
          break
        }
      }
      if (!found) setActiveType('action')
    }
    editor.on('selectionUpdate', syncType)
    editor.on('update', syncType)
    syncType()
    return () => { editor.off('selectionUpdate', syncType); editor.off('update', syncType) }
  }, [editor, setActiveType])

  // ── Navigate to scene by heading text ────────────────────────────────────
  const navigateToHeading = React.useCallback(
    (heading: string) => {
      if (!editor || !heading) return
      const upper = heading.toUpperCase()
      let targetPos = -1
      editor.state.doc.forEach((node, offset) => {
        if (targetPos !== -1) return
        if (
          node.type.name === 'scriptBlock' &&
          node.attrs.elementType === 'slugline' &&
          node.textContent.toUpperCase() === upper
        ) {
          targetPos = offset + 1
        }
      })
      if (targetPos < 0) return
      editor.chain().focus().setTextSelection(targetPos).scrollIntoView().run()
    },
    [editor]
  )

  const setHeaderChrome = useScreenplayHeaderChromeStore((s) => s.setChrome)
  React.useEffect(() => {
    setHeaderChrome({
      zoom,
      collabActive,
      handlers: editor
        ? {
            zoomOut: () =>
              setZoom((z) =>
                Math.max(SCREENPLAY_ZOOM_MIN, Math.round((z - SCREENPLAY_ZOOM_STEP) * 100) / 100),
              ),
            zoomIn: () =>
              setZoom((z) =>
                Math.min(SCREENPLAY_ZOOM_MAX, Math.round((z + SCREENPLAY_ZOOM_STEP) * 100) / 100),
              ),
            zoomReset: () => setZoom(1),
            print: () => void printScreenplayHidden(editor),
          }
        : null,
    })
    return () => {
      setHeaderChrome({ handlers: null, collabActive: false, zoom: 1 })
    }
  }, [zoom, collabActive, editor, setHeaderChrome])

  // ── Derived ──────────────────────────────────────────────────────────────
  const sceneCount = projectScenes.length

  if (!editor) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minHeight: 0 }}>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── SCENE PANEL — populated from project outline ─────────────── */}
        {navigatorOpen && (
          <Paper
            className="screenplay-navigator"
            elevation={0}
            square
            sx={{
              width: 220,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRight: `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.25,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flexShrink: 0,
              }}
            >
              <LocalMoviesIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}
              >
                Scenes
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }} />
              <Chip label={sceneCount} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              <Tooltip title="Hide scene panel">
                <IconButton size="small" onClick={() => setNavigatorOpen(false)} aria-label="toggle scene panel">
                  <MenuOpenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {projectScenes.length === 0 ? (
                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.disabled">
                    No scenes in your outline yet.
                    <br />
                    Add scenes in the Outline tab to see them here.
                  </Typography>
                </Box>
              ) : (
                <List dense disablePadding>
                  {projectScenes.map((scene, i) => {
                    const heading = getSceneHeading(scene)
                    return (
                      <Tooltip
                        key={scene._id ?? i}
                        title={heading || '(No scene heading)'}
                        placement="right"
                        arrow
                        enterDelay={600}
                      >
                        <ListItemButton
                          onClick={() => navigateToHeading(heading)}
                          sx={{
                            px: 2,
                            py: 0.75,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            '&:last-child': { borderBottom: 'none' },
                            alignItems: 'flex-start',
                            gap: 1,
                          }}
                        >
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.disabled"
                            sx={{ fontFamily: 'monospace', minWidth: 20, mt: '1px', flexShrink: 0 }}
                          >
                            {i + 1}
                          </Typography>
                          <ListItemText
                            primary={heading || '(No heading)'}
                            primaryTypographyProps={{
                              variant: 'caption',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              lineHeight: 1.3,
                              color: heading ? 'text.primary' : 'text.disabled',
                              sx: {
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              },
                            }}
                          />
                        </ListItemButton>
                      </Tooltip>
                    )
                  })}
                </List>
              )}
            </Box>
          </Paper>
        )}

        {/* ── SCREENPLAY WORKSPACE: toolbar fixed above scroll; only the page scrolls ─ */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            backgroundColor: '#ffffff',
            px: 3,
            pb: 5,
            pt: 0,
          }}
        >
          <Box
            sx={{
              mt: 5,
              flex: 1,
              minHeight: 0,
              width: '100%',
              maxWidth: SCREENPLAY_EDITOR_COLUMN_WIDTH_PX,
              alignSelf: 'center',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
            }}
          >
            {!navigatorOpen && (
              <Box
                sx={{
                  width: '100%',
                  boxSizing: 'border-box',
                  pl: `${SCREENPLAY_SCROLL_GUTTER_LEFT_PX}px`,
                  pr: `${SCREENPLAY_SCROLL_GUTTER_RIGHT_PX}px`,
                  mb: 1,
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <Tooltip title="Show scene panel">
                  <IconButton size="small" onClick={() => setNavigatorOpen(true)} aria-label="toggle scene panel">
                    <MenuIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            <Box
              sx={{
                width: '100%',
                boxSizing: 'border-box',
                pl: `${SCREENPLAY_SCROLL_GUTTER_LEFT_PX}px`,
                pr: `${SCREENPLAY_SCROLL_GUTTER_RIGHT_PX}px`,
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              <Box
                ref={toolbarScaleStageRef}
                sx={{
                  margin: '0 auto',
                  flexShrink: 0,
                  /* Don't clip: overflow:hidden cuts off the element toolbar's rounded top corners after scale() */
                  overflow: 'visible',
                }}
              >
                <Box
                  ref={toolbarScaleInnerRef}
                  sx={{
                    width: `${SCREENPLAY_PAPER_WIDTH_PX}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <ScreenplayDocumentToolbar
                    collabActive={collabActive}
                    isSavingOrPending={isSavingOrPending}
                    showSaved={showSaved}
                  />
                </Box>
              </Box>
            </Box>
            <Box
              ref={workspaceRef}
              className="screenplay-workspace"
              sx={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                overflowY: 'auto',
                overflowX: 'auto',
                backgroundColor: '#ffffff',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <Box
                sx={{
                  pb: 5,
                  boxSizing: 'border-box',
                  pl: `${SCREENPLAY_SCROLL_GUTTER_LEFT_PX}px`,
                  pr: `${SCREENPLAY_SCROLL_GUTTER_RIGHT_PX}px`,
                }}
              >
                <Box
                  ref={stageRef}
                  sx={{
                    position: 'relative',
                    margin: '0 auto',
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <Box ref={pageRef} className="screenplay-page" data-zoom={zoom}>
                      <EditorContent editor={editor} />
                      <BlockAltsToolbar editor={editor} canEdit={canEdit} userId={user} />
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
