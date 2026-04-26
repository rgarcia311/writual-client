'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { CollaborationCursor } from './CollaborationCursorExtension'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from 'graphql-request'
import {
  Avatar,
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
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
import { SceneCard } from '@/components/SceneCard'
import { CharacterCard } from '@/components/CharacterCard'
import { updateCharacter as updateCharacterAction } from '@/app/actions/characters'
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
import {
  SCREENPLAY_EDITOR_COLUMN_WIDTH_PX,
  SCREENPLAY_PAPER_HEIGHT_PX,
  SCREENPLAY_PAPER_WIDTH_PX,
  SCREENPLAY_SCROLL_GUTTER_LEFT_PX,
  SCREENPLAY_SCROLL_GUTTER_RIGHT_PX,
} from './screenplayPaperLayout'
import {
  getSluglineChipLabel,
  getSluglineLocation,
  type SluglineLocation,
} from './screenplaySluglineUtils'

// ─── Scene navigator width (flex — reflows editor; do not use absolute + padding sync) ─
/**
 * When the list is expanded, the list `Paper` flex-grows within the navigator column (0.7 vs editor 1.3).
 * Do not use overflowX: hidden on the main row to mask editor overflow.
 */
/** Matches `ProjectDetailsLayout` outer `Container` `pl` so the editor can bleed edge-to-edge under the header. */
const PROJECT_LAYOUT_CONTENT_INSET_LEFT_PX = 13
/** Vertical Scenes / Characters tabs on the left edge of the screenplay area. */
const SIDE_PANEL_TABS_W_PX = 40
const SCENE_STRIP_W_COLLAPSED_PX = 56
/** Extra right inset so `.screenplay-page` box-shadow isn’t lost at the scroll edge. */
const SCREENPLAY_PAGE_SHADOW_INSET_PX = 12
const WORKSPACE_H_INSET_PX = 20 + SCREENPLAY_PAGE_SHADOW_INSET_PX

function sluglineChipMuiColor(
  loc: SluglineLocation,
): 'primary' | 'success' | 'warning' | 'default' {
  if (loc === 'INT') return 'primary'
  if (loc === 'EXT') return 'success'
  if (loc === 'I_E') return 'warning'
  return 'default'
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SceneVersion {
  sceneHeading?: string
  version?: number
  step?: string
  act?: number
}

interface ProjectScene {
  _id: string
  activeVersion?: number
  lockedVersion?: number | null
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

interface SceneCardStepOption {
  name: string
  number: number
  act: string
}

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
  const theme = useTheme()
  const [navigatorOpen, setNavigatorOpen] = React.useState(true)
  /** Wide list vs. narrow strip (scene INT/EXT chips or character initials). */
  const [sidePanelExpanded, setSidePanelExpanded] = React.useState(true)
  /** Which side panel list is shown when the navigator is open. */
  const [sidePanelTab, setSidePanelTab] = React.useState<'scenes' | 'characters'>('scenes')
  const [characterCardExpandedId, setCharacterCardExpandedId] = React.useState<number | undefined>(
    undefined,
  )
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
  const navigatorSplitProportions = navigatorOpen && sidePanelExpanded
  /** When list is off or only the narrow strip: center the screenplay column; expanded list hugs the right. */
  const centerEditorColumn = !navigatorOpen || (navigatorOpen && !sidePanelExpanded)

  if (!editor) return null

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        minHeight: 0,
        // Cancel project layout left inset so side tabs + panel sit flush left; header stays padded in `ProjectDetailsLayout`.
        marginLeft: `-${PROJECT_LAYOUT_CONTENT_INSET_LEFT_PX}px`,
        width: `calc(100% + ${PROJECT_LAYOUT_CONTENT_INSET_LEFT_PX}px)`,
        minWidth: 0,
        boxSizing: 'border-box',
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
          pt: 3.75,
        }}
      >

        {/* ── Side tabs + panel (scenes or character cards) — flush with layout’s left content edge via root bleed ─ */}
        {navigatorOpen && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignSelf: 'stretch',
              minHeight: 0,
              minWidth: 0,
              ...(navigatorSplitProportions
                ? { flex: '0.7 1 0%' }
                : { flex: '0 0 auto' }),
            }}
          >
            <Box
              sx={{
                width: SIDE_PANEL_TABS_W_PX,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                alignSelf: 'stretch',
                minHeight: 0,
                boxSizing: 'border-box',
                bgcolor: 'background.paper',
              }}
            >
              <Box
                role="tablist"
                aria-label="Screenplay side panel"
                aria-orientation="vertical"
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  py: 1.25,
                  pl: 0,
                  pr: 0.5,
                  gap: 0.75,
                  minHeight: 0,
                }}
              >
                {(
                  [
                    { id: 'scenes' as const, label: 'Scenes', Icon: LocalMoviesIcon },
                    { id: 'characters' as const, label: 'Characters', Icon: PersonIcon },
                  ] as const
                ).map(({ id, label, Icon }) => {
                  const selected = sidePanelTab === id
                  return (
                    <ButtonBase
                      key={id}
                      role="tab"
                      aria-selected={selected}
                      id={`screenplay-side-tab-${id}`}
                      onClick={() => {
                        setSidePanelTab(id)
                      }}
                      focusRipple
                      sx={{
                        flex: 1,
                        minHeight: 72,
                        maxHeight: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '0 12px 12px 0',
                        color: 'text.primary',
                        bgcolor: selected ? 'action.selected' : 'transparent',
                        border: (t) => `1px solid ${t.palette.divider}`,
                        boxShadow: 'none',
                        transition: (t) => t.transitions.create(['background-color', 'color'], {
                          duration: t.transitions.duration.shorter,
                        }),
                        '&:hover': {
                          bgcolor: selected ? 'action.selected' : 'action.hover',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.5,
                          py: 0.5,
                        }}
                      >
                        <Icon
                          sx={{
                            fontSize: 18,
                            color: selected ? 'text.primary' : 'text.secondary',
                          }}
                        />
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            fontWeight: 800,
                            letterSpacing: 0.2,
                            lineHeight: 1.1,
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            fontSize: '0.68rem',
                            textTransform: 'uppercase',
                          }}
                        >
                          {label}
                        </Typography>
                      </Box>
                    </ButtonBase>
                  )
                })}
              </Box>
              <Box
                sx={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 1,
                  borderTop: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                {sidePanelExpanded ? (
                  <Tooltip title="Narrow list">
                    <IconButton
                      size="small"
                      onClick={() => setSidePanelExpanded(false)}
                      aria-label="Narrow list"
                      aria-expanded
                    >
                      <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Widen list">
                    <IconButton
                      size="small"
                      onClick={() => setSidePanelExpanded(true)}
                      aria-label="Widen list"
                      aria-expanded={false}
                    >
                      <ChevronRightIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Hide side panel">
                  <IconButton
                    size="small"
                    onClick={() => setNavigatorOpen(false)}
                    aria-label="Hide side panel"
                  >
                    <MenuIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Paper
              className="screenplay-navigator"
              elevation={0}
              sx={{
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                alignSelf: 'stretch',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                boxShadow: theme.shadows[1],
                overflow: 'hidden',
                transition: theme.transitions.create(['box-shadow', 'border-color'], {
                  duration: theme.transitions.duration.shorter,
                }),
                ...(sidePanelExpanded
                  ? { flex: '1 1 0%', minWidth: 0 }
                  : {
                      width: SCENE_STRIP_W_COLLAPSED_PX,
                      minWidth: SCENE_STRIP_W_COLLAPSED_PX,
                      maxWidth: SCENE_STRIP_W_COLLAPSED_PX,
                      flexShrink: 0,
                    }),
              }}
            >
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
              {sidePanelTab === 'scenes' && (
                <>
                  {projectScenes.length === 0 ? (
                sidePanelExpanded ? (
                  <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.disabled">
                      No scenes in your outline yet.
                      <br />
                      Add scenes in the Outline tab to see them here.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ py: 1.5, display: 'flex', justifyContent: 'center' }} aria-label="No scenes">
                    <LocalMoviesIcon sx={{ fontSize: 20, color: 'text.disabled', opacity: 0.5 }} />
                  </Box>
                )
              ) : sidePanelExpanded ? (
                <Box
                  sx={{
                    p: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  {projectScenes.map((scene, i) => {
                    const activeVersion = scene.activeVersion ?? 1
                    const avIdx = Math.max(0, activeVersion - 1)
                    const v = scene.versions?.[avIdx] ?? scene.versions?.[0]
                    return (
                      <SceneCard
                        key={scene._id ?? i}
                        sceneId={scene._id}
                        number={i + 1}
                        newScene={false}
                        versions={scene.versions ?? []}
                        activeVersion={activeVersion}
                        lockedVersion={scene.lockedVersion ?? null}
                        projectId={projectId}
                        step={v?.step ?? ''}
                        act={v?.act}
                        steps={sceneCardSteps}
                        fullWidthInParent
                      />
                    )
                  })}
                </Box>
              ) : (
                <Box
                  sx={{
                    py: 0.5,
                    px: 0.5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  {projectScenes.map((scene, idx) => {
                    const heading = getSceneHeading(scene)
                    const loc = getSluglineLocation(heading)
                    const label = getSluglineChipLabel(loc)
                    return (
                      <Tooltip key={scene._id ?? idx} title={heading || '(No scene heading)'} placement="right" arrow>
                        <Chip
                          size="small"
                          label={label}
                          onClick={() => navigateToHeading(heading)}
                          color={sluglineChipMuiColor(loc)}
                          variant={loc === 'OTHER' ? 'outlined' : 'filled'}
                          sx={{
                            minWidth: 40,
                            height: 22,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      </Tooltip>
                    )
                  })}
                </Box>
              )}
                </>
              )}

              {sidePanelTab === 'characters' && (
                <>
                  {projectCharacters.length === 0 ? (
                    sidePanelExpanded ? (
                      <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled">
                          No characters yet.
                          <br />
                          Add characters on the Characters page.
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{ py: 1.5, display: 'flex', justifyContent: 'center' }}
                        aria-label="No characters"
                      >
                        <PersonIcon sx={{ fontSize: 20, color: 'text.disabled', opacity: 0.5 }} />
                      </Box>
                    )
                  ) : sidePanelExpanded ? (
                    <Box
                      sx={{
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      {projectCharacters.map((character, index) => {
                        const cardId = index + 1
                        return (
                          <CharacterCard
                            key={character._id ?? `character-${index}`}
                            id={cardId}
                            name={character.name}
                            imageUrl={character.imageUrl}
                            details={character.details}
                            expanded={characterCardExpandedId === cardId}
                            onExpandClick={() =>
                              setCharacterCardExpandedId((prev) => (prev === cardId ? undefined : cardId))
                            }
                            locked={character.lockedVersion != null}
                            onToggleLock={() =>
                              updateCharacterLockMutation.mutate({
                                characterId: character._id,
                                locked: character.lockedVersion == null,
                              })
                            }
                            fullWidthInParent
                          />
                        )
                      })}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        py: 0.5,
                        px: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {projectCharacters.map((c, idx) => {
                        const name = (c.name ?? '').trim() || 'Character'
                        const initial = name.charAt(0).toUpperCase() || '?'
                        return (
                          <Tooltip key={c._id ?? idx} title={name} placement="right" arrow>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                fontSize: '0.75rem',
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                              }}
                            >
                              {initial}
                            </Avatar>
                          </Tooltip>
                        )
                      })}
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Paper>
          </Box>
        )}

        {/* ── SCREENPLAY: column with optional “show side panel” row; single scroll with sticky element toolbar (matches page width) ─ */}
        <Box
          sx={{
            ...(navigatorSplitProportions
              ? { flex: '1.3 1 0%' }
              : { flex: 1 }),
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            backgroundColor: '#ffffff',
            pl: centerEditorColumn ? `${WORKSPACE_H_INSET_PX}px` : 0,
            pr: `${WORKSPACE_H_INSET_PX}px`,
            pb: 5,
            pt: 0,
            boxSizing: 'border-box',
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              width: '100%',
              maxWidth: SCREENPLAY_EDITOR_COLUMN_WIDTH_PX,
              alignSelf: centerEditorColumn ? 'center' : 'flex-end',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              ...(centerEditorColumn ? { marginLeft: 'auto', marginRight: 'auto' } : {}),
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
                    <MenuIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
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
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  width: '100%',
                  boxSizing: 'border-box',
                  pl: `${SCREENPLAY_SCROLL_GUTTER_LEFT_PX}px`,
                  pr: `${SCREENPLAY_SCROLL_GUTTER_RIGHT_PX + SCREENPLAY_PAGE_SHADOW_INSET_PX}px`,
                  flexShrink: 0,
                  bgcolor: '#ffffff',
                }}
              >
                <Box
                  ref={toolbarScaleStageRef}
                  sx={{
                    position: 'relative',
                    marginLeft: 'auto',
                    marginRight: 0,
                    flexShrink: 0,
                    overflow: 'visible',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      left: 'auto',
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top right',
                    }}
                  >
                    <Box
                      ref={toolbarScaleInnerRef}
                      sx={{
                        width: `${SCREENPLAY_PAPER_WIDTH_PX}px`,
                        boxSizing: 'border-box',
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
              </Box>
              <Box
                sx={{
                  pb: 5,
                  boxSizing: 'border-box',
                  pl: `${SCREENPLAY_SCROLL_GUTTER_LEFT_PX}px`,
                  pr: `${SCREENPLAY_SCROLL_GUTTER_RIGHT_PX + SCREENPLAY_PAGE_SHADOW_INSET_PX}px`,
                }}
              >
                <Box
                  ref={stageRef}
                  sx={{
                    position: 'relative',
                    marginLeft: 'auto',
                    marginRight: 0,
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      left: 'auto',
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top right',
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
