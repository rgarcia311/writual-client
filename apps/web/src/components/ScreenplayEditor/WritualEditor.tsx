'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { CollaborationCursor } from './CollaborationCursorExtension'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from 'graphql-request'
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Snackbar,
  Tooltip,
  Typography,
} from '@mui/material'
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import NotesIcon from '@mui/icons-material/Notes'
import FastForwardIcon from '@mui/icons-material/FastForward'
import TitleIcon from '@mui/icons-material/Title'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ContactMailIcon from '@mui/icons-material/ContactMail'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import PersonIcon from '@mui/icons-material/Person'

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
import { updateCharacter as updateCharacterAction } from '@/app/actions/characters'
import {
  ScreenplaySidePanel,
  type ProjectScene,
  type SceneCardStepOption,
  type SceneVersion,
} from './ScreenplaySidePanel'
import { OUTLINE_FRAMEWORKS_QUERY } from '@/queries/OutlineQueries'
import { PROJECT_CHARACTERS_QUERY } from '@/queries/CharacterQueries'
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries'
import type { OutlineFrameworkItem } from '@/state/outlineFrameworks'
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
// <PROTECTED>
import {
  SCREENPLAY_DISPLAY_SCALE,
  SCREENPLAY_EDITOR_COLUMN_WIDTH_PX,
  SCREENPLAY_FLOATING_SURFACE_SHADOW,
  SCREENPLAY_PAPER_HEIGHT_PX,
  SCREENPLAY_PAPER_WIDTH_PX,
  SCREENPLAY_SCROLL_GUTTER_LEFT_PX,
  SCREENPLAY_SCROLL_GUTTER_RIGHT_PX,
} from './screenplayPaperLayout'
// </PROTECTED>
// ─── Scene navigator width (flex — reflows editor; do not use absolute + padding sync) ─
/**
 * When the list is expanded, the list `Paper` flex-grows within the navigator column (0.7 vs editor 1.3).
 * Do not use overflowX: hidden on the main row to mask editor overflow.
 */
// <PROTECTED>
/** Matches `ProjectDetailsLayout` outer `Container` `pl` so the editor can bleed edge-to-edge under the header. */
const PROJECT_LAYOUT_CONTENT_INSET_LEFT_PX = 13
/** Small cushion so `.screenplay-page` rim shadow isn’t fully lost at the scroll edge. */
const SCREENPLAY_PAGE_SHADOW_INSET_PX = 4
const WORKSPACE_H_INSET_PX = 20 + SCREENPLAY_PAGE_SHADOW_INSET_PX

/** Horizontal insets for the scroll inner that wraps `stageRef`. Left is 0 — the vertical toolbar is the left visual boundary. */
const SCREENPLAY_WORKSPACE_SCROLL_GUTTER_SX = {
  boxSizing: 'border-box' as const,
  pl: 0,
  pr: `${SCREENPLAY_SCROLL_GUTTER_RIGHT_PX + SCREENPLAY_PAGE_SHADOW_INSET_PX}px`,
}
// </PROTECTED>

// ─── Element icon map ─────────────────────────────────────────────────────────

export const ELEMENT_ICONS: Record<ScreenplayElementType, React.ReactNode> = {
  title:         <TitleIcon sx={{ fontSize: 14 }} />,
  author:        <EditNoteIcon sx={{ fontSize: 14 }} />,
  contact:       <ContactMailIcon sx={{ fontSize: 14 }} />,
  slugline:      <LocalMoviesIcon sx={{ fontSize: 14 }} />,
  action:        <NotesIcon sx={{ fontSize: 14 }} />,
  character:     <PersonIcon sx={{ fontSize: 14 }} />,
  parenthetical: <FormatQuoteIcon sx={{ fontSize: 14 }} />,
  dialogue:      <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />,
  transition:    <FastForwardIcon sx={{ fontSize: 14 }} />,
}

export const ELEMENT_ORDER: ScreenplayElementType[] = [
  'title',
  'author',
  'contact',
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
  title:         'Enter → Author  ·  Title page',
  author:        'Enter → Contact',
  contact:       'Enter → Action',
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
  const outlineName = project?.outlineName?.trim() ?? null

  const { data: frameworksData } = useQuery({
    queryKey: ['outline-frameworks', user, projectId],
    queryFn: async () => request(GRAPHQL_ENDPOINT, OUTLINE_FRAMEWORKS_QUERY, { user }),
    enabled: Boolean(outlineName && user && projectId),
  }) as { data: { getOutlineFrameworks?: any[] } | undefined }

  const outlineFramework: OutlineFrameworkItem | null = React.useMemo(() => {
    const list = frameworksData?.getOutlineFrameworks ?? []
    return list.find((f) => (f.name ?? '').trim() === outlineName) ?? null
  }, [frameworksData, outlineName])

  /** Same `steps` list as the Outline page `SceneCard` (assign-to-step). */
  const sceneCardSteps = React.useMemo(
    () => {
      if (!outlineFramework?.format?.steps?.length) return []
      return outlineFramework.format.steps.map((s: { name?: string; number?: number; act?: string }) => ({
        name: (s.name ?? '').trim() || `Step ${s.number ?? 0}`,
        number: s.number ?? 0,
        act: s.act ?? '',
      }))
    },
    [outlineFramework],
  )

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
      sceneCardSteps={sceneCardSteps}
    />
  )
}

// ─── Middle Layer — collab resource gate ───────────────────────────────────────

interface CollabGateProps {
  projectId?: string
  canEdit: boolean
  projectScenes: ProjectScene[]
  savedScreenplayContent: unknown
  sceneCardSteps: SceneCardStepOption[]
}

function CollabGate({
  projectId,
  canEdit,
  projectScenes,
  savedScreenplayContent,
  sceneCardSteps,
}: CollabGateProps) {
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
      sceneCardSteps={sceneCardSteps}
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
  sceneCardSteps: SceneCardStepOption[]
  ydoc: Y.Doc | null
  provider: HocuspocusProvider | null
}

function ScreenplayEditorCore({
  projectId,
  canEdit,
  projectScenes,
  savedScreenplayContent,
  sceneCardSteps,
  ydoc,
  provider,
}: ScreenplayEditorCoreProps) {
  const [navigatorOpen, setNavigatorOpen] = React.useState(true)
  /** Wide list vs. narrow strip (scene INT/EXT chips or character initials). */
  const [sidePanelExpanded, setSidePanelExpanded] = React.useState(true)
  /** Which side panel list is shown when the navigator is open. */
  const [sidePanelTab, setSidePanelTab] = React.useState<'scenes' | 'characters'>('scenes')
  const [characterCardExpandedId, setCharacterCardExpandedId] = React.useState<number | undefined>(
    undefined,
  )
  const [zoom, setZoom] = React.useState(SCREENPLAY_DISPLAY_SCALE)
  const [isAutoZoomed, setIsAutoZoomed] = React.useState(false)
  const [autoZoomSnackbarOpen, setAutoZoomSnackbarOpen] = React.useState(false)
  /** Mirrors `isAutoZoomed` for use inside ResizeObserver / event callbacks without stale closure. */
  const isAutoZoomedRef = React.useRef(false)

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
    // <PROTECTED>
    const stage = stageRef.current
    if (!stage) return
    const z = zoomRef.current
    const { width, height } = paperLayoutRef.current
    stage.style.width = `${width * z}px`
    stage.style.height = `${height * z}px`
    // </PROTECTED>
  }, [])

  React.useLayoutEffect(() => {
    applyStageDimensions()
  }, [zoom, applyStageDimensions])

  /** Calculate the zoom factor that fits exactly one paper height into the workspace. */
  const calcAutoFitZoom = React.useCallback((workspaceEl: HTMLElement): number => {
    // <PROTECTED>
    const availableHeight = workspaceEl.clientHeight - 40
    const availableWidth =
      workspaceEl.clientWidth - SCREENPLAY_SCROLL_GUTTER_LEFT_PX - SCREENPLAY_SCROLL_GUTTER_RIGHT_PX
    const targetScale = Math.min(
      availableHeight / SCREENPLAY_PAPER_HEIGHT_PX,
      availableWidth / SCREENPLAY_PAPER_WIDTH_PX,
    )
    // Cap at SCREENPLAY_DISPLAY_SCALE so auto-fit never makes the page larger than 709 × 917 px.
    // On viewports too small for that size, the viewport-fit constraint still shrinks further.
    return Math.min(SCREENPLAY_DISPLAY_SCALE, Math.max(SCREENPLAY_ZOOM_MIN, targetScale))
    // </PROTECTED>
  }, [])

  /** Apply auto-fit zoom on first mount (before paint). */
  React.useLayoutEffect(() => {
    // <PROTECTED>
    const workspaceEl = workspaceRef.current
    if (!workspaceEl) return
    const fitted = calcAutoFitZoom(workspaceEl)
    setZoom(fitted)
    isAutoZoomedRef.current = true
    setIsAutoZoomed(true)
    if (fitted < SCREENPLAY_DISPLAY_SCALE - 0.001) {
      setAutoZoomSnackbarOpen(true)
    }
    // </PROTECTED>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — runs once on mount


  React.useEffect(() => {
    // <PROTECTED>
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
    // </PROTECTED>
    return () => {
      ro.disconnect()
    }
  }, [applyStageDimensions])

  /** Reapply auto-fit whenever the workspace resizes, as long as the user hasn't overridden zoom. */
  React.useEffect(() => {
    // <PROTECTED>
    const workspaceEl = workspaceRef.current
    if (!workspaceEl) return
    const ro = new ResizeObserver(() => {
      if (!isAutoZoomedRef.current) return
      setZoom(calcAutoFitZoom(workspaceEl))
    })
    ro.observe(workspaceEl)
    // </PROTECTED>
    return () => { ro.disconnect() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcAutoFitZoom]) // calcAutoFitZoom is stable (useCallback with no deps)

  React.useEffect(() => {
    // <PROTECTED>
    const el = workspaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      isAutoZoomedRef.current = false
      setIsAutoZoomed(false)
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
    // </PROTECTED>
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const { setActiveType, setCanEdit, setElementTypeFnRef } = useScreenplayEditorStore()

  const seededRef = React.useRef(false)

  const user = useUserProfileStore((s) => s.userProfile?.user)
  const queryClient = useQueryClient()

  const { data: charactersData } = useQuery({
    queryKey: ['project-characters', projectId],
    queryFn: async () =>
      request(GRAPHQL_ENDPOINT, PROJECT_CHARACTERS_QUERY, {
        input: { user, _id: projectId },
      }),
    enabled: Boolean(projectId && user),
  })
  const projectCharacters: any[] = (charactersData as any)?.getProjectData?.[0]?.characters ?? []

  const updateCharacterLockMutation = useMutation({
    mutationFn: async ({ characterId, locked }: { characterId: string; locked: boolean }) => {
      const character = projectCharacters.find((c) => c._id === characterId)
      const activeVersion = character?.activeVersion ?? 1
      return updateCharacterAction(characterId, {
        activeVersion,
        lockedVersion: locked ? activeVersion : null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-characters', projectId] })
      await queryClient.refetchQueries({ queryKey: ['project-characters', projectId] })
    },
  })

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

  const setHeaderChrome = useScreenplayHeaderChromeStore((s) => s.setChrome)
  React.useEffect(() => {
    setHeaderChrome({
      // <PROTECTED>
      zoom,
      collabActive,
      handlers: editor
        ? {
            zoomOut: () => {
              isAutoZoomedRef.current = false
              setIsAutoZoomed(false)
              setZoom((z) =>
                Math.max(SCREENPLAY_ZOOM_MIN, Math.round((z - SCREENPLAY_ZOOM_STEP) * 100) / 100),
              )
            },
            zoomIn: () => {
              isAutoZoomedRef.current = false
              setIsAutoZoomed(false)
              setZoom((z) =>
                Math.min(SCREENPLAY_ZOOM_MAX, Math.round((z + SCREENPLAY_ZOOM_STEP) * 100) / 100),
              )
            },
            zoomReset: () => {
              isAutoZoomedRef.current = false
              setIsAutoZoomed(false)
              setZoom(SCREENPLAY_DISPLAY_SCALE)
            },
            print: () => void printScreenplayHidden(editor),
          }
        : null,
      // </PROTECTED>
    })
    return () => {
      setHeaderChrome({ handlers: null, collabActive: false, zoom: 1 })
    }
  }, [zoom, collabActive, editor, setHeaderChrome])

  // ── Derived ──────────────────────────────────────────────────────────────
  const navigatorSplitProportions = navigatorOpen && sidePanelExpanded
  /** When list is off or only the narrow strip: center the screenplay column; expanded list hugs the right. */
  const centerEditorColumn = !navigatorOpen || (navigatorOpen && !sidePanelExpanded)

  if (!editor) return null

  return (
    <Box
      sx={{
        // <PROTECTED>
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        minHeight: 0,
        // Cancel project layout left inset so side tabs + panel sit flush left; header stays padded in `ProjectDetailsLayout`.
        width: "100%",
        minWidth: 0,
        boxSizing: 'border-box',
        // </PROTECTED>
        
      }}
    >

      {/* ── BODY: side tabs + side panel + editor; moved up 10px vs previous pt(5) ─ */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          pt: 1,
          pb: 1
        }}
      >

        {/* ── Side tabs + panel (scenes or character cards) — flush with layout's left content edge via root bleed ─ */}
        {navigatorOpen && (
          <ScreenplaySidePanel
            navigatorSplitProportions={navigatorSplitProportions}
            sidePanelTab={sidePanelTab}
            onTabChange={setSidePanelTab}
            sidePanelExpanded={sidePanelExpanded}
            onExpandedChange={setSidePanelExpanded}
            characterCardExpandedId={characterCardExpandedId}
            onCharacterCardExpandedChange={setCharacterCardExpandedId}
            projectScenes={projectScenes}
            projectCharacters={projectCharacters}
            projectId={projectId}
            sceneCardSteps={sceneCardSteps}
            onToggleCharacterLock={(characterId, locked) =>
              updateCharacterLockMutation.mutate({ characterId, locked })
            }
          />
        )}

        {/* Fills remaining row width when centering; marginLeft auto keeps editor right when list expanded */}
        <Box
          sx={{
            display: 'flex',
            ...(centerEditorColumn
              ? { flex: '1 1 0%', minWidth: 0, justifyContent: 'center' }
              : { flex: '0 0 auto', marginLeft: 'auto' }),
          }}
        >
        {/* ── SCREENPLAY: column with optional show-side-panel row; vertical toolbar attached left of page ─ */}
        <Box
          sx={{
            // <PROTECTED>
            width: "max-content",
            minHeight: 0,
            overflowX: 'clip',
            overflowY: 'visible',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            backgroundColor: '#ffffff',
            pl: 0,
            //pr: `${WORKSPACE_H_INSET_PX}px`,
            pt: 0,
            boxSizing: 'border-box',
            // </PROTECTED>
            
          }}
        >
          <Box
            sx={{
              // <PROTECTED>
              //flex: 1,
              minHeight: "100%",
              //minWidth: SCREENPLAY_EDITOR_COLUMN_WIDTH_PX,
              alignSelf: centerEditorColumn ? 'center' : 'flex-end',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              ...(centerEditorColumn ? { marginLeft: 'auto', marginRight: 'auto' } : {}),
              // </PROTECTED>
              
            }}
          >
            {!navigatorOpen && (
              <Box
                sx={{
                  width: '100%',
                  boxSizing: 'border-box',
                  pr: `${SCREENPLAY_SCROLL_GUTTER_RIGHT_PX}px`,
                  mb: 1,
                  flexShrink: 0,
                  minWidth: 0,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Tooltip title="Show side panel (scenes & characters)">
                  <IconButton
                    size="small"
                    onClick={() => setNavigatorOpen(true)}
                    aria-label="Show side panel"
                  >
                    <ViewSidebarIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            {/* Flex row: vertical toolbar (non-scrolling) + scroll workspace */}
            {/* <PROTECTED> */}
            <Box sx={{ 
              width: "753px",
              minHeight: "100%", 
              display: 'flex', 
              flexDirection: 'row', 
              alignItems: 'stretch',  }}>
              {/* Vertical toolbar — outside the scroll container; does not scroll with pages */}
              <ScreenplayDocumentToolbar
                orientation="vertical"
                collabActive={collabActive}
                isSavingOrPending={isSavingOrPending}
                showSaved={showSaved}
              />
              {/* Scroll workspace */}
              <Box
                ref={workspaceRef}
                className="screenplay-workspace"
                sx={{
                  // <PROTECTED>
                  minHeight: 0,
                  minWidth: 0,
                  overflowY: 'auto',
                  overflowX: 'auto',
                  backgroundColor: '#ffffff',
                  WebkitOverflowScrolling: 'touch',
                  // </PROTECTED>
                  
                }}
              >
                <Box
                  sx={{
                    // <PROTECTED>
                    ...SCREENPLAY_WORKSPACE_SCROLL_GUTTER_SX,
                    // </PROTECTED>
                    
                  }}
                >
                  <Box
                    ref={stageRef}
                    sx={{
                      // <PROTECTED>
                      position: 'relative',
                      marginLeft: 0,
                      marginRight: 'auto',
                      flexShrink: 0,
                      boxShadow: SCREENPLAY_FLOATING_SURFACE_SHADOW,
                      // </PROTECTED>
                    }}
                  >
                    <Box
                      sx={{
                        // <PROTECTED>
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 'auto',
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        // </PROTECTED>
                      }}
                    >
                      <Box ref={pageRef} className="screenplay-page" data-zoom={zoom}>
                        <EditorContent editor={editor} />
                        {/* </PROTECTED> */}
                        <BlockAltsToolbar editor={editor} canEdit={canEdit} userId={user} />
                        {/* <PROTECTED> */}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
            {/* </PROTECTED> */}
          </Box>
        </Box>
        </Box>
      </Box>

      <Snackbar
        open={autoZoomSnackbarOpen}
        autoHideDuration={5000}
        onClose={() => setAutoZoomSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setAutoZoomSnackbarOpen(false)}
          severity="info"
          variant="filled"
          sx={{ width: '100%' }}
        >
          Zoom adjusted to fit your screen resolution. Use Ctrl+Scroll or the header controls to adjust.
        </Alert>
      </Snackbar>
    </Box>
  )
}
