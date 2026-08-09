'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { CollaborationCursor } from './CollaborationCursorExtension'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { BlockTypeMenu } from './BlockTypeMenu'
import { ScreenplayScenePanesLayer } from './ScreenplayScenePanesLayer'
import { ScreenplayCharacterPanesLayer } from './ScreenplayCharacterPanesLayer'
import {
  ScreenplayDocumentToolbar,
  SCREENPLAY_VERTICAL_TOOLBAR_W_PX,
  SCREENPLAY_ZOOM_MAX,
  SCREENPLAY_ZOOM_MIN,
  SCREENPLAY_ZOOM_STEP,
} from './ScreenplayDocumentToolbar'
import { ScreenplayInspirationPanesLayer } from './ScreenplayInspirationPanesLayer'
import { ScreenplayStatsPanesLayer } from './ScreenplayStatsPanesLayer'
import { PROJECT_CHARACTERS_QUERY } from '@/queries/CharacterQueries'
import { useScreenplayCharacterLookupStore } from '@/state/screenplayCharacterLookup'
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries'
import { PROJECT_SCENES_QUERY_KEY } from 'hooks'
import { useAutosave } from '@hooks/useAutosave'
import { useCollaboration } from '@hooks/useCollaboration'
import { useSyncWritingTrackerPageCount } from '@hooks/useSyncWritingTrackerPageCount'
import { useUserProfileStore } from '@/state/user'
import { useScreenplaySaveStatusStore } from '@/state/screenplaySaveStatus'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { useScreenplayHeaderChromeStore } from '@/state/screenplayHeaderChrome'
import { useScreenplaySceneOutlineStore, type ProjectScene } from '@/state/screenplaySceneOutline'
import { GRAPHQL_ENDPOINT } from '@/lib/config'
import {
  applyLayoutConfigToPage,
  clampLayoutConfig,
  resetLayoutConfigOnPage,
  type ScreenplayLayoutConfig,
} from '@/lib/screenplayLayout'
import { readScreenplayPaginationTotalPages } from '../../utils/screenplayPaginationRead'
import { courierPrime } from '../../utils/fonts'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import type * as Y from 'yjs'
import './Screenplay.css'
// <PROTECTED>
import {
  SCREENPLAY_DISPLAY_SCALE,
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

/**
 * Classic / overlay vertical scrollbars sit on the workspace’s right; reserve width so the
 * lateral rim shadow isn’t painted under the thumb / track (scrollbar-gutter alone is not enough).
 */
const SCREENPLAY_WORKSPACE_SCROLLBAR_SHADOW_PAD_PX = 16

/** Total right inset for the scroll inner (gutter + shadow bleed + scrollbar column). */
const SCREENPLAY_WORKSPACE_SCROLL_INNER_PAD_RIGHT_PX =
  SCREENPLAY_SCROLL_GUTTER_RIGHT_PX +
  SCREENPLAY_PAGE_SHADOW_INSET_PX +
  SCREENPLAY_WORKSPACE_SCROLLBAR_SHADOW_PAD_PX

/** Outward bleed for SCREENPLAY_FLOATING_SURFACE_SHADOW lateral layer (offset + blur − spread cushion). */
const SCREENPLAY_STAGE_RIM_HORIZONTAL_OUTSET_PX = 18

/** Horizontal insets for the scroll inner that wraps `stageRef`. Left is 0 — the vertical toolbar is the left visual boundary.
 *  pt/pb explicit here (not just in screenplayWorkspace.css) so the zero-offset can't be silently
 *  outranked by a same-specificity Emotion-injected rule that happens to load later in <head>. */
const SCREENPLAY_WORKSPACE_SCROLL_GUTTER_SX = {
  boxSizing: 'border-box' as const,
  pl: 0,
  pr: `${SCREENPLAY_WORKSPACE_SCROLL_INNER_PAD_RIGHT_PX}px`,
  pt: 0,
  pb: 0,
  mt: 0,
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

/** Title-page-only element types — enabled in the toolbar only while the cursor is on the title page. */
export const TITLE_PAGE_ELEMENT_ORDER: ScreenplayElementType[] = [
  'title',
  'author',
  'contact',
]

/** Body (script page) element types, in toolbar display order. */
export const BODY_ELEMENT_ORDER: ScreenplayElementType[] = [
  'slugline',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
]

export const ELEMENT_ORDER: ScreenplayElementType[] = [
  ...TITLE_PAGE_ELEMENT_ORDER,
  ...BODY_ELEMENT_ORDER,
]

/**
 * Keyboard shortcut hints shown in each toolbar toggle button tooltip.
 * ⌘/Ctrl+E then <n> sets element directly (tap ⌘/Ctrl+E to arm, then a bare digit within ~1.5s):
 *   1 Scene Heading · 2 Action · 3 Character · 4 Dialogue · 5 Parenthetical · 6 Transition.
 * Tab cycles from Action: ×1 Scene Heading · ×2 Character · ×3 Parenthetical · ×4 Dialogue · ×5 back to Action.
 * Enter: character→dialogue · parenthetical→dialogue · dialogue→action · slugline→action
 */
export const ELEMENT_SHORTCUTS: Record<ScreenplayElementType, string> = {
  title:         'Enter → Author  ·  Title page',
  author:        'Enter → Contact',
  contact:       'Enter → Action',
  slugline:      '⌘/Ctrl+E then 1  ·  Tab ×1 from Action',
  action:        '⌘/Ctrl+E then 2  ·  Tab ×5 cycles back here  ·  Enter after Dialogue or Scene Heading',
  character:     '⌘/Ctrl+E then 3  ·  Tab ×2 from Action',
  dialogue:      '⌘/Ctrl+E then 4  ·  Tab ×4 from Action  ·  Enter after Character or Parenthetical',
  parenthetical: '⌘/Ctrl+E then 5  ·  Tab ×3 from Action  ·  Enter after Character',
  transition:    '⌘/Ctrl+E then 6  ·  Click to set  (not in Tab cycle)',
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

/** Placeholder shown when the user's full name can't be determined from their profile. */
const CONTACT_NAME_PLACEHOLDER = 'Contact Name'
/** Placeholder shown when the user's email can't be determined from their profile. */
const CONTACT_EMAIL_PLACEHOLDER = 'Contact Email'

/**
 * `title` / `author` / `contact` scriptBlocks pre-filled from the project + signed-in user, to
 * prepend to a freshly seeded (never-before-saved) screenplay doc. Contact name/email fall back to
 * literal placeholder text so the user has something in-place to edit; the phone number is always a
 * placeholder since it isn't stored on the user profile.
 */
function buildTitlePageBlocks(
  projectTitle: string | null | undefined,
  userDisplayName: string | null | undefined,
  userName: string | null | undefined,
  userEmail: string | null | undefined,
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []

  const trimmedTitle = (projectTitle ?? '').trim()
  if (trimmedTitle) {
    blocks.push({
      type: 'scriptBlock',
      attrs: { elementType: 'title' },
      content: [{ type: 'text', text: trimmedTitle }],
    })
  }

  const contactName = (userDisplayName || userName || '').trim() || CONTACT_NAME_PLACEHOLDER
  const contactEmail = (userEmail ?? '').trim() || CONTACT_EMAIL_PLACEHOLDER

  blocks.push({
    type: 'scriptBlock',
    attrs: { elementType: 'author' },
    content: [
      {
        type: 'text',
        text: contactName === CONTACT_NAME_PLACEHOLDER ? 'written by' : `written by ${contactName}`,
      },
    ],
  })

  for (const line of [contactName, contactEmail, 'Contact Phone Number']) {
    blocks.push({
      type: 'scriptBlock',
      attrs: { elementType: 'contact' },
      content: [{ type: 'text', text: line }],
    })
  }

  return blocks
}

/** Body seeded when a project has no outline scenes yet. */
const FALLBACK_BODY_BLOCKS: Record<string, unknown>[] = [
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
]

export const TITLE_PAGE_ELEMENT_TYPES = new Set(['title', 'author', 'contact'])

/** Body content (scene-derived or fallback) with the title page prepended, for seeding a brand-new doc. */
function buildSeedDoc(
  projectScenes: ProjectScene[],
  titlePageBlocks: Record<string, unknown>[],
): Record<string, unknown> {
  const bodyBlocks = projectScenes.length
    ? ((buildDocFromScenes(projectScenes).content as Record<string, unknown>[]) ?? [])
    : FALLBACK_BODY_BLOCKS
  return { type: 'doc', content: [...titlePageBlocks, ...bodyBlocks] }
}

function scriptBlockElementType(block: unknown): string {
  return (block as { attrs?: { elementType?: string } })?.attrs?.elementType ?? ''
}

function scriptBlockText(block: unknown): string {
  const content = (block as { content?: Array<{ text?: string }> })?.content
  if (!Array.isArray(content)) return ''
  return content.map((node) => node?.text ?? '').join('')
}

/**
 * True when `doc`'s body (everything but the title/author/contact blocks) is still exactly the
 * untouched no-scenes fallback — i.e. nothing the user or a scene-derived seed ever wrote. Compares
 * only element type + text, not the full node (scriptBlock also carries `versions`/`activeVersionId`
 * attrs that Tiptap fills with schema defaults on `setContent`, so a full deep-equal against the
 * plain seed literal never matches the editor's actual `getJSON()` output). Safe to replace because
 * real typed content (a real scene heading, dialogue, etc.) can never match this exact text.
 */
function isUntouchedFallbackBody(doc: unknown): boolean {
  const content = (doc as { content?: unknown[] } | null)?.content
  if (!Array.isArray(content)) return false
  const body = content
    .filter((block) => !TITLE_PAGE_ELEMENT_TYPES.has(scriptBlockElementType(block)))
    .map((block) => ({ elementType: scriptBlockElementType(block), text: scriptBlockText(block) }))
  const fallback = FALLBACK_BODY_BLOCKS.map((block) => ({
    elementType: scriptBlockElementType(block),
    text: scriptBlockText(block),
  }))
  return JSON.stringify(body) === JSON.stringify(fallback)
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
  const projectTitle: string | null = project?.title ?? null
  const projectScenes: ProjectScene[] = project?.scenes ?? []
  const setScreenplaySceneOutlines = useScreenplaySceneOutlineStore((s) => s.setScenes)
  React.useEffect(() => {
    setScreenplaySceneOutlines(projectScenes)
  }, [projectScenes, setScreenplaySceneOutlines])
  const savedScreenplayContent = project?.screenplay?.versions?.[0]?.content ?? null
  const savedScreenplayLayout = (project?.screenplay?.layout ?? null) as ScreenplayLayoutConfig | null
  const writingTracker = project?.writingTracker ?? null

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
      projectTitle={projectTitle}
      projectScenes={projectScenes}
      savedScreenplayContent={savedScreenplayContent}
      savedScreenplayLayout={savedScreenplayLayout}
      writingTracker={writingTracker}
    />
  )
}

// ─── Middle Layer — collab resource gate ───────────────────────────────────────

interface CollabGateProps {
  projectId?: string
  canEdit: boolean
  projectTitle: string | null
  projectScenes: ProjectScene[]
  savedScreenplayContent: unknown
  savedScreenplayLayout: ScreenplayLayoutConfig | null
  writingTracker: { enabled?: boolean } | null | undefined
}

function CollabGate({
  projectId,
  canEdit,
  projectTitle,
  projectScenes,
  savedScreenplayContent,
  savedScreenplayLayout,
  writingTracker,
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
      projectTitle={projectTitle}
      projectScenes={projectScenes}
      savedScreenplayContent={savedScreenplayContent}
      savedScreenplayLayout={savedScreenplayLayout}
      writingTracker={writingTracker}
      ydoc={failed ? null : ydoc}
      provider={failed ? null : provider}
    />
  )
}

// ─── Inner Component — Tiptap editor with stable extensions ───────────────────

interface ScreenplayEditorCoreProps {
  projectId?: string
  canEdit: boolean
  projectTitle: string | null
  projectScenes: ProjectScene[]
  savedScreenplayContent: unknown
  savedScreenplayLayout: ScreenplayLayoutConfig | null
  writingTracker: { enabled?: boolean } | null | undefined
  ydoc: Y.Doc | null
  provider: HocuspocusProvider | null
}

function ScreenplayEditorCore({
  projectId,
  canEdit,
  projectTitle,
  projectScenes,
  savedScreenplayContent,
  savedScreenplayLayout,
  writingTracker,
  ydoc,
  provider,
}: ScreenplayEditorCoreProps) {
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

  useSyncWritingTrackerPageCount({
    pageRef,
    projectId,
    trackerEnabled: writingTracker?.enabled === true,
    canEdit,
  })

  const estimateAutosavePaginationPages = React.useCallback((): number | null => {
    const root = pageRef.current
    if (!root) return null
    return readScreenplayPaginationTotalPages(root)
  }, [])

  /**
   * Apply per-document layout overrides (from an imported PDF's measured geometry) as inline CSS
   * custom properties on the `.screenplay-page` element. Page width and right margin are never
   * changed (always 8.5×11" with a fixed 1.0" WGA right margin); only element indents and
   * centered-column right pads shift. Absent config ⇒ defaults. PageBreakPlugin re-paginates from
   * the DOM after the wrapping changes.
   */
  const layoutConfig = React.useMemo(
    () => clampLayoutConfig(savedScreenplayLayout),
    [savedScreenplayLayout],
  )

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

  /** Calculate the zoom factor that fits one canonical page into the workspace, filling edge-to-edge. */
  const calcAutoFitZoom = React.useCallback((workspaceEl: HTMLElement): number => {
    // <PROTECTED>
    // No reserved top/bottom bleed anymore (screenplayWorkspace.css no longer pads the scroll
    // inner) — the page fits the full workspace height, flush at both scroll extremes.
    const availableHeight = workspaceEl.clientHeight
    const availableWidth =
      workspaceEl.clientWidth -
      SCREENPLAY_SCROLL_GUTTER_LEFT_PX -
      SCREENPLAY_WORKSPACE_SCROLL_INNER_PAD_RIGHT_PX
    const targetScale = Math.min(
      availableHeight / SCREENPLAY_PAPER_HEIGHT_PX,
      availableWidth / SCREENPLAY_PAPER_WIDTH_PX,
    )
    return Math.min(SCREENPLAY_ZOOM_MAX, Math.max(SCREENPLAY_ZOOM_MIN, targetScale))
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
    if (fitted <= SCREENPLAY_ZOOM_MIN + 0.001) {
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
  const userDisplayName = useUserProfileStore((s) => s.userProfile?.displayName)
  const userName = useUserProfileStore((s) => s.userProfile?.name)
  const userEmail = useUserProfileStore((s) => s.userProfile?.email)
  const queryClient = useQueryClient()

  /** Title/author/contact blocks to prepend when seeding a brand-new (never-saved) screenplay doc. */
  const titlePageBlocks = React.useMemo(
    () => buildTitlePageBlocks(projectTitle, userDisplayName, userName, userEmail),
    [projectTitle, userDisplayName, userName, userEmail],
  )

  const { data: charactersData } = useQuery({
    queryKey: ['project-characters', projectId],
    queryFn: async () =>
      request(GRAPHQL_ENDPOINT, PROJECT_CHARACTERS_QUERY, {
        input: { user, _id: projectId },
      }),
    enabled: Boolean(projectId && user),
  })
  const projectCharacters: any[] = (charactersData as any)?.getProjectData?.[0]?.characters ?? []

  const setScreenplayCharacters = useScreenplayCharacterLookupStore((s) => s.setCharacters)
  React.useEffect(() => {
    setScreenplayCharacters(projectCharacters)
  }, [projectCharacters, setScreenplayCharacters])

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

  /**
   * Apply per-document layout overrides (from an imported PDF's measured geometry) as inline CSS
   * custom properties on the `.screenplay-page` element. Page width is never changed (8.5×11 stays
   * exact); only the right margin, element indents, and centered-column right pads shift. Absent
   * config ⇒ defaults. PageBreakPlugin re-paginates from the DOM after the wrapping changes.
   *
   * Depends on `editor`, not just `layoutConfig`: with `immediatelyRender: false`, `editor` is null
   * on the first render (Tiptap not yet initialized), so the component returns `null` below before
   * ever attaching `pageRef` — this effect would otherwise only ever see `pageRef.current === null`
   * and silently no-op forever, since `layoutConfig` itself doesn't change once `editor` becomes
   * ready a render later.
   */
  React.useEffect(() => {
    const page = pageRef.current
    if (!page) return
    applyLayoutConfigToPage(page, layoutConfig)
    return () => {
      resetLayoutConfigOnPage(page)
    }
  }, [layoutConfig, editor])

  // ── Debug: log full editor document as JSON ──────────────────────────────
  React.useEffect(() => {
    if (!editor) return
    const logJson = () => {
      console.log('[ScreenplayEditor] doc JSON:', JSON.stringify(editor.getJSON(), null, 2))
    }
    logJson()
    editor.on('update', logJson)
    return () => {
      editor.off('update', logJson)
    }
  }, [editor])

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
        const legacyContent = savedScreenplayContent || buildSeedDoc(projectScenes, titlePageBlocks)
        editor.commands.setContent(legacyContent)
      } else if (
        !savedScreenplayContent &&
        projectScenes.length > 0 &&
        isUntouchedFallbackBody(editor.getJSON())
      ) {
        // A prior visit seeded the no-scenes fallback before this project had any outline scenes.
        // Nothing has been typed since (body still matches the fallback exactly) — safe to re-seed.
        editor.commands.setContent(buildSeedDoc(projectScenes, titlePageBlocks))
      }
    }

    provider.on('synced', handleSynced)
    return () => { provider.off('synced', handleSynced) }
  }, [editor, provider, collabActive, savedScreenplayContent, projectScenes, titlePageBlocks])

  // ── Non-collab seeding (standalone mode) ─────────────────────────────────
  React.useEffect(() => {
    if (!editor || seededRef.current || collabActive) return
    seededRef.current = true

    if (savedScreenplayContent) {
      // Self-heal: if a prior visit saved only the untouched no-scenes fallback and this project now
      // has outline scenes, re-seed from them instead of reloading the stale placeholder.
      const content =
        projectScenes.length > 0 && isUntouchedFallbackBody(savedScreenplayContent)
          ? buildSeedDoc(projectScenes, titlePageBlocks)
          : savedScreenplayContent
      queueMicrotask(() => editor.commands.setContent(content))
      return
    }

    const doc = buildSeedDoc(projectScenes, titlePageBlocks)

    queueMicrotask(() => editor.commands.setContent(doc))
  }, [editor, projectScenes, savedScreenplayContent, collabActive, titlePageBlocks])

  // ── Autosave (disabled when collab is active) ────────────────────────────
  useAutosave(editor, projectId, {
    enabled: canEdit && !collabActive,
    onPending: () => setPending(true),
    onSaveStart: startSaving,
    onSaveEnd: (success) => {
      endSaving(success)
      if (success && projectId) {
        void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        void queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, projectId] })
      }
    },
    estimatePageCount: estimateAutosavePaginationPages,
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
      isAutoZoomed,
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
              const workspaceEl = workspaceRef.current
              if (!workspaceEl) return
              isAutoZoomedRef.current = true
              setIsAutoZoomed(true)
              setZoom(calcAutoFitZoom(workspaceEl))
            },
            print: () => void printScreenplayHidden(editor),
          }
        : null,
      // </PROTECTED>
    })
    return () => {
      setHeaderChrome({ handlers: null, collabActive: false, zoom: 1, isAutoZoomed: false })
    }
  }, [zoom, isAutoZoomed, collabActive, editor, setHeaderChrome, calcAutoFitZoom])

  // ── Derived ──────────────────────────────────────────────────────────────
  /** Editor is always centered now that the inspiration/stats side panel is gone. */
  const centerEditorColumn = true

  /** Toolbar + scaled paper + gutter + lateral rim shadow must fit workspace width (`flex: 1`), or horizontal overflow clips the right halo. */
  const screenplayToolbarPaperRowMinWidthPx =
    SCREENPLAY_VERTICAL_TOOLBAR_W_PX +
    Math.ceil(SCREENPLAY_PAPER_WIDTH_PX * zoom) +
    SCREENPLAY_WORKSPACE_SCROLL_INNER_PAD_RIGHT_PX +
    SCREENPLAY_STAGE_RIM_HORIZONTAL_OUTSET_PX

  /**
   * Cap the toolbar + workspace row at exactly one page's on-screen height, so a fully-scrolled
   * page's top/bottom line up with the toolbar's top/bottom instead of the row stretching to fill
   * the whole viewport (which reveals a sliver of the next page below a full one on tall screens).
   * On short viewports this cap is moot — `minHeight: 0` on the row still lets it shrink further.
   */
  const screenplayToolbarPaperRowMaxHeightPx = Math.ceil(SCREENPLAY_PAPER_HEIGHT_PX * zoom)

  if (!editor) return null

  return (
    <Box
      className="writual-editor-root"
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
        className="writual-editor-body"
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          bgcolor: 'background.default',
        }}
      >

        {/* Fills remaining row width, centering the editor column */}
        <Box
          className="screenplay-editor-col screenplay-editor-col--centered"
          sx={{
            display: 'flex',
            flex: '1 1 0%',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            alignSelf: 'stretch',
            justifyContent: 'center',
          }}
        >
        {/* ── SCREENPLAY: vertical toolbar attached left of page ─ */}
        <Box
          sx={{
            // <PROTECTED>
            width: "max-content",
            minHeight: 0,
            /* clip keeps horizontal bleed contained; reserve right inset so lateral box-shadow survives */
            overflowX: 'visible',
            overflowY: 'visible',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            backgroundColor: '#ffffff',
            pl: 0,
            pr: `${SCREENPLAY_WORKSPACE_SCROLL_INNER_PAD_RIGHT_PX}px`,
            pt: 0,
            boxSizing: 'border-box',
            // </PROTECTED>
            
          }}
        >
          <Box
            sx={{
              // <PROTECTED>
              minHeight: "100%",
              alignSelf: centerEditorColumn ? 'center' : 'flex-end',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              ...(centerEditorColumn ? { marginLeft: 'auto', marginRight: 'auto' } : {}),
              // </PROTECTED>

            }}
          >
            {/* Flex row: vertical toolbar (non-scrolling) + scroll workspace */}
            {/* <PROTECTED> */}
            <Box sx={{
              width: `${screenplayToolbarPaperRowMinWidthPx}px`,
              height: '100%',
              maxHeight: `${screenplayToolbarPaperRowMaxHeightPx}px`,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
            }}>
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
                      <Box
                        ref={pageRef}
                        className="screenplay-page"
                        data-zoom={zoom}
                        style={courierPrime.style}
                      >
                        <EditorContent editor={editor} />
                        {/* </PROTECTED> */}
                        <BlockAltsToolbar editor={editor} canEdit={canEdit} userId={user} />
                        <BlockTypeMenu editor={editor} canEdit={canEdit} />
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

      <ScreenplayScenePanesLayer />
      <ScreenplayCharacterPanesLayer />
      <ScreenplayInspirationPanesLayer />
      <ScreenplayStatsPanesLayer />
    </Box>
  )
}
