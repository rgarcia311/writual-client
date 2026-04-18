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
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'
import PrintIcon from '@mui/icons-material/Print'
import PersonIcon from '@mui/icons-material/Person'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import NotesIcon from '@mui/icons-material/Notes'
import FastForwardIcon from '@mui/icons-material/FastForward'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import FitScreenIcon from '@mui/icons-material/FitScreen'

import {
  ScriptBlock,
  SCREENPLAY_ELEMENT_LABELS,
  type ScreenplayElementType,
} from './ScreenplayExtension'
import { PageBreakExtension } from './PageBreakPlugin'
import { BlockAltsToolbar } from './BlockAltsToolbar'
import { ScreenplayToolbar } from './ScreenplayToolbar'
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries'
import { PROJECT_SCENES_QUERY_KEY } from 'hooks'
import { useAutosave } from '@hooks/useAutosave'
import { useCollaboration } from '@hooks/useCollaboration'
import { useUserProfileStore } from '@/state/user'
import { useScreenplaySaveStatusStore } from '@/state/screenplaySaveStatus'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { GRAPHQL_ENDPOINT } from '@/lib/config'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import type * as Y from 'yjs'
import './Screenplay.css'
import {
  SCREENPLAY_PAPER_HEIGHT_PX,
  SCREENPLAY_PAPER_WIDTH_PX,
} from './screenplayPaperLayout'

const SCREENPLAY_ZOOM_MIN = 0.5
const SCREENPLAY_ZOOM_MAX = 2
const SCREENPLAY_ZOOM_STEP = 0.1

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

function countWordsFromDoc(doc: import('@tiptap/pm/model').Node): number {
  let count = 0
  doc.descendants((node) => {
    if (node.isTextblock) {
      const text = node.textContent.trim()
      if (text) count += text.split(/\s+/).filter(Boolean).length
      return false
    }
  })
  return count
}

function estimatePages(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 180))
}

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

// ─── Print utility ────────────────────────────────────────────────────────────

/**
 * TipTap output is schema-bound, but the print popup uses document.write with
 * interpolated HTML. Strip executable vectors and plugin-only UI (page labels).
 */
function sanitizeScreenplayHtmlForPrint(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<div id="__sanitize_root">${html}</div>`, 'text/html')
  const root = doc.getElementById('__sanitize_root')
  if (!root) return html
  root.querySelectorAll('script, iframe, object, embed').forEach((n) => n.remove())
  root.querySelectorAll('.screenplay-page-number').forEach((n) => n.remove())
  root.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((a) => {
      const lower = a.name.toLowerCase()
      if (lower.startsWith('on') || lower === 'srcdoc' || lower === 'formaction') {
        el.removeAttribute(a.name)
      }
    })
  })
  return root.innerHTML
}

function printScreenplay(html: string) {
  const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
  if (!win) {
    console.warn('Popup blocked — please allow popups for this site to print.')
    return
  }

  const safeHtml = sanitizeScreenplayHtmlForPrint(html)

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Screenplay</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
  @page {
    size: letter;
    margin: 1in 1in 1in 1.5in; /* Standard WGA 1.5" left binding margin */
  }
  /* Note: Chromium/WebKit do not render @page margin boxes; page numbers in print
     would require pre-split HTML or a print engine that supports margin boxes. */
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
    font-size: 12pt;
    line-height: 1.0;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  .script-block {
    margin: 0;
    padding: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    break-inside: avoid;
    page-break-inside: avoid;
    line-height: 12pt; /* Force exact typewriter line-height */
    font-size: 12pt;
  }
  /* Enforce Screenplay Widow/Orphan Rules */
  .script-block[data-element-type="action"],
  .script-block[data-element-type="dialogue"] {
    orphans: 2;
    widows: 2;
  }
  /* Never strand a preceding element at the bottom of a page */
  .script-block[data-element-type="character"],
  .script-block[data-element-type="transition"],
  .script-block[data-element-type="slugline"] {
    break-after: avoid;
    page-break-after: avoid;
  }
  .script-block:last-child { margin-bottom: 0; }
  .script-block p { margin: 0; padding: 0; }
  .script-block[data-element-type="slugline"] {
    text-transform: uppercase;
    font-weight: 700;
    margin-top: 12pt;
    margin-bottom: 12pt;
    margin-right: -36pt;
    break-after: avoid;
    page-break-after: avoid;
  }
  .script-block[data-element-type="slugline"]:first-child { margin-top: 0; }
  .script-block[data-element-type="action"] {
    margin-bottom: 12pt;
    margin-right: -36pt;
  }
  .script-block[data-element-type="character"] {
    margin-left: 2.2in;
    text-transform: uppercase;
    margin-bottom: 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  .script-block[data-element-type="parenthetical"] {
    margin-left: 1.6in;
    margin-right: 1.9in;
    margin-bottom: 0;
    break-before: avoid;
    break-after: avoid;
    page-break-before: avoid;
    page-break-after: avoid;
  }
  .script-block[data-element-type="dialogue"] {
    margin-left: 1.0in;
    margin-right: 1.5in;
    margin-bottom: 12pt;
    break-before: avoid;
    page-break-before: avoid;
  }
  .script-block[data-element-type="transition"] {
    text-align: right;
    text-transform: uppercase;
    margin-top: 12pt;
    margin-bottom: 12pt;
  }
</style>
</head>
<body>${safeHtml}</body>
</html>`)

  win.document.close()

  if (win.document.fonts?.ready) {
    win.document.fonts.ready.then(() => { win.focus(); win.print(); win.close() })
  } else {
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }
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
  const [wordCount, setWordCount] = React.useState(0)
  const [zoom, setZoom] = React.useState(1)

  const workspaceRef = React.useRef<HTMLDivElement | null>(null)
  const stageRef = React.useRef<HTMLDivElement | null>(null)
  const pageRef = React.useRef<HTMLDivElement | null>(null)
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
  const collabStatus = useScreenplayEditorStore((s) => s.collabStatus)
  const connectedUsers = useScreenplayEditorStore((s) => s.connectedUsers)

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

  // ── Debounced word count ─────────────────────────────────────────────────
  React.useEffect(() => {
    if (!editor) return
    let timer: ReturnType<typeof setTimeout>
    const syncWordCount = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setWordCount(countWordsFromDoc(editor.state.doc)), 500)
    }
    editor.on('update', syncWordCount)
    syncWordCount()
    return () => { editor.off('update', syncWordCount); clearTimeout(timer) }
  }, [editor, setWordCount])

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

  // ── Print ────────────────────────────────────────────────────────────────
  const handlePrint = React.useCallback(() => {
    if (editor) printScreenplay(editor.getHTML())
  }, [editor])

  // ── Derived ──────────────────────────────────────────────────────────────
  const pages = estimatePages(wordCount)
  const sceneCount = projectScenes.length

  if (!editor) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minHeight: 0 }}>

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <Paper
        className="screenplay-toolbar"
        elevation={0}
        square
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
          flexWrap: 'wrap',
          minHeight: 48,
        }}
      >
        <Tooltip title={navigatorOpen ? 'Hide scene panel' : 'Show scene panel'}>
          <IconButton size="small" onClick={() => setNavigatorOpen((v) => !v)} aria-label="toggle scene panel">
            {navigatorOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ScreenplayToolbar />

        <Box sx={{ flex: 1, minWidth: 8 }} />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' }, fontFamily: 'monospace', whiteSpace: 'nowrap' }}
        >
          {wordCount.toLocaleString()} words · ~{pages}p
        </Typography>

        {/* ── Collab status indicators ──────────────────────────────────── */}
        {collabActive && collabStatus === 'connecting' && (
          <Chip label="Syncing..." size="small" color="warning" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
        )}
        {collabActive && collabStatus === 'disconnected' && (
          <Chip label="Offline" size="small" color="error" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
        )}
        {collabActive && collabStatus === 'connected' && connectedUsers.length > 1 && (
          <Chip label={`${connectedUsers.length} online`} size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
        )}

        {/* ── Save status indicators (solo mode only) ──────────────────── */}
        {!collabActive && isSavingOrPending && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} aria-label="Saving">
            <CloudDoneIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              ...saving
            </Typography>
          </Box>
        )}
        {!collabActive && showSaved && (
          <Box sx={{ display: 'flex', alignItems: 'center' }} aria-label="Saved">
            <CloudDoneIcon sx={{ fontSize: 18, color: 'success.main' }} />
          </Box>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Zoom out (Ctrl/Cmd + scroll)">
          <span>
            <IconButton
              size="small"
              onClick={() =>
                setZoom((z) =>
                  Math.max(SCREENPLAY_ZOOM_MIN, Math.round((z - SCREENPLAY_ZOOM_STEP) * 100) / 100),
                )
              }
              disabled={zoom <= SCREENPLAY_ZOOM_MIN}
              aria-label="zoom out screenplay"
            >
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: 'monospace', minWidth: 36, textAlign: 'center' }}
          aria-live="polite"
        >
          {Math.round(zoom * 100)}%
        </Typography>
        <Tooltip title="Zoom in (Ctrl/Cmd + scroll)">
          <span>
            <IconButton
              size="small"
              onClick={() =>
                setZoom((z) =>
                  Math.min(SCREENPLAY_ZOOM_MAX, Math.round((z + SCREENPLAY_ZOOM_STEP) * 100) / 100),
                )
              }
              disabled={zoom >= SCREENPLAY_ZOOM_MAX}
              aria-label="zoom in screenplay"
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reset zoom to 100%">
          <span>
            <IconButton
              size="small"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
              aria-label="reset screenplay zoom"
            >
              <FitScreenIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Print screenplay — opens a clean print dialog with correct 8.5″×11″ formatting">
          <IconButton size="small" onClick={handlePrint} aria-label="print screenplay">
            <PrintIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

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
              <Chip label={sceneCount} size="small" sx={{ ml: 'auto', height: 18, fontSize: '0.65rem' }} />
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

        {/* ── SCREENPLAY WORKSPACE ─────────────────────────────────────── */}
        <Box
          ref={workspaceRef}
          className="screenplay-workspace"
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#d0d0d0',
            py: 5,
            px: 3,
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
              <Box ref={pageRef} className="screenplay-page">
                <EditorContent editor={editor} />
                <BlockAltsToolbar editor={editor} canEdit={canEdit} userId={user} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
