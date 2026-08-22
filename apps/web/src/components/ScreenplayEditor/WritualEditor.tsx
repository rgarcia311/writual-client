'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { CollaborationCursor } from './CollaborationCursorExtension'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from 'graphql-request'
import { authRequest } from '@/lib/authRequest'
import {
  Alert,
  Box,
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
import {
  ScreenplayInstantPreview,
  screenplaySnapshotKey,
} from './ScreenplayInstantPreview'
import { PROJECT_CHARACTERS_QUERY } from '@/queries/CharacterQueries'
import { useScreenplayCharacterLookupStore } from '@/state/screenplayCharacterLookup'
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries'
import { PROJECT_SCENES_QUERY_KEY } from 'hooks'
import { useAutosave } from '@hooks/useAutosave'
import { useCollaboration } from '@hooks/useCollaboration'
import {
  useScreenplayDocuments,
  SCREENPLAY_DOCUMENT_QUERY_KEY,
  SCREENPLAY_DOCUMENTS_QUERY_KEY,
} from '@hooks/useScreenplayDocuments'
import { useScreenplayDocumentsStore } from '@/state/screenplayDocuments'
import { SCREENPLAY_DOCUMENT_QUERY } from '@/queries/ScreenplayQueries'
import { useSyncWritingTrackerPageCount } from '@hooks/useSyncWritingTrackerPageCount'
import { useScreenplaySnapshotPersistence } from '@hooks/useScreenplaySnapshotPersistence'
import { useUserProfileStore } from '@/state/user'
import { useScreenplaySaveStatusStore } from '@/state/screenplaySaveStatus'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { useScreenplayLivePagesStore } from '@/state/screenplayLivePages'
import { useScreenplayHeaderChromeStore } from '@/state/screenplayHeaderChrome'
import { useScreenplaySceneOutlineStore, type ProjectScene } from '@/state/screenplaySceneOutline'
import { GRAPHQL_ENDPOINT } from '@/lib/config'
import {
  applyLayoutConfigToPage,
  clampLayoutConfig,
  resetLayoutConfigOnPage,
  type ScreenplayLayoutConfig,
} from '@/lib/screenplayLayout'
import { readScreenplayBodyPageCount } from '../../utils/screenplayPaginationRead'
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

  /**
   * Which of the project's screenplay documents to edit. The tab bar writes this selection; the
   * characters and outline pages read the same store so all three stay on the same script.
   */
  const { activeDocumentId, isLoading: documentsLoading } = useScreenplayDocuments(projectId)

  /**
   * Script body for the selected document only. `getProjectData` deliberately returns screenplay
   * metadata without `versions.content`, so a project holding several feature scripts doesn't ship
   * all of them on every page load.
   */
  const { data: documentData, isLoading: documentLoading } = useQuery({
    queryKey: [SCREENPLAY_DOCUMENT_QUERY_KEY, projectId, activeDocumentId],
    // `getScreenplayDocument` enforces project membership server-side, so this read must carry the
    // Firebase token rather than going out anonymously like the older project queries.
    queryFn: async () =>
      authRequest(SCREENPLAY_DOCUMENT_QUERY, {
        projectId,
        documentId: activeDocumentId,
      }),
    enabled: Boolean(projectId && user && activeDocumentId),
  }) as { data: any; isLoading: boolean }

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
  const screenplayDocument = (documentData as any)?.getScreenplayDocument ?? null
  const savedScreenplayContent = screenplayDocument?.versions?.[0]?.content ?? null
  const savedScreenplayLayout = (screenplayDocument?.layout ?? null) as ScreenplayLayoutConfig | null
  const writingTracker = project?.writingTracker ?? null

  /**
   * Show the server's stored body-page total the moment project data lands, so the toolbar reads a
   * real number while Tiptap mounts and paginates. `useSyncWritingTrackerPageCount` overwrites it
   * with the measured value as soon as PageBreakPlugin's first pass completes.
   */
  const seedBodyPages = useScreenplayLivePagesStore((s) => s.setSeedBodyPagesForProject)
  const serverPageCount: number | null = screenplayDocument?.pageCount ?? null
  React.useEffect(() => {
    if (!projectId || serverPageCount == null) return
    seedBodyPages(projectId, serverPageCount)
  }, [projectId, serverPageCount, seedBodyPages])

  const canEdit = React.useMemo(() => {
    if (!project || !user) return false
    if (project.user === user) return true
    if (project.sharedWith?.includes(user)) return true
    return project.collaborators?.some(
      (c: any) => c.uid === user && c.status === 'active' && c.permissionLevel === 'edit'
    ) ?? false
  }, [project, user])

  // The document body is a separate round trip; showing the editor before it lands would flash an
  // empty script and then replace it.
  if (scenesLoading || documentsLoading || documentLoading) {
    return <ScreenplayInstantPreview projectId={projectId} documentId={activeDocumentId} />
  }

  return (
    <CollabGate
      key={activeDocumentId ?? 'primary'}
      projectId={projectId}
      documentId={activeDocumentId}
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
  documentId: string | null
  canEdit: boolean
  projectTitle: string | null
  projectScenes: ProjectScene[]
  savedScreenplayContent: unknown
  savedScreenplayLayout: ScreenplayLayoutConfig | null
  writingTracker: { enabled?: boolean } | null | undefined
}

function CollabGate({
  projectId,
  documentId,
  canEdit,
  projectTitle,
  projectScenes,
  savedScreenplayContent,
  savedScreenplayLayout,
  writingTracker,
}: CollabGateProps) {
  // Each screenplay document has its own Y.Doc; without scoping the name, two documents in one
  // project would share collaboration state and overwrite each other.
  const { ydoc, provider, failed } = useCollaboration(projectId, documentId)

  if (projectId && !failed && (!ydoc || !provider)) {
    return <ScreenplayInstantPreview projectId={projectId} documentId={documentId} />
  }

  return (
    <ScreenplayEditorCore
      key={`${projectId}-${documentId ?? 'primary'}-${failed ? 'solo' : 'collab'}`}
      projectId={projectId}
      documentId={documentId}
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
  documentId: string | null
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
  documentId,
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
  /** Measured content-box height of the editor column; sizes the toolbar + paper row (see below). */
  const [editorColContentHeightPx, setEditorColContentHeightPx] = React.useState<number | null>(null)
  /** Mirrors `isAutoZoomed` for use inside ResizeObserver / event callbacks without stale closure. */
  const isAutoZoomedRef = React.useRef(false)

  const workspaceRef = React.useRef<HTMLDivElement | null>(null)
  /** Auto-fit measures this column, not the workspace: the workspace's own box is derived from
   *  `zoom`, so measuring it makes the fit self-referential (see `calcAutoFitZoom`). */
  const editorColRef = React.useRef<HTMLDivElement | null>(null)
  /**
   * The same node as `editorColRef`, mirrored into state.
   *
   * `useEditor` returns null on the first render(s) and `if (!editor) return null` below keeps the
   * whole tree — the column included — unmounted until it resolves, so a ref is still null when
   * effects first run. Every effect here that reads `editorColRef.current` therefore needs this in
   * its deps to re-run once the column exists; with `[]` they bail on the null ref and never fire
   * again, which pins `zoom` at its initial `SCREENPLAY_DISPLAY_SCALE` and leaves both
   * ResizeObservers unattached — no re-fit on window resize at all.
   */
  const [editorColEl, setEditorColEl] = React.useState<HTMLDivElement | null>(null)
  const attachEditorColRef = React.useCallback((node: HTMLDivElement | null) => {
    editorColRef.current = node
    setEditorColEl(node)
  }, [])
  const stageRef = React.useRef<HTMLDivElement | null>(null)
  const pageRef = React.useRef<HTMLDivElement | null>(null)
  const paperLayoutRef = React.useRef({
    width: SCREENPLAY_PAPER_WIDTH_PX,
    height: SCREENPLAY_PAPER_HEIGHT_PX,
  })
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom

  const estimateAutosavePaginationPages = React.useCallback((): number | null => {
    const root = pageRef.current
    if (!root) return null
    return readScreenplayBodyPageCount(root)
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

  /**
   * Zoom that fits one canonical page into the editor column, filling it edge-to-edge.
   *
   * Measures the COLUMN (`.screenplay-editor-col`), never the workspace. The workspace's own box is
   * a function of `zoom` — its height is capped at `1056 * zoom` (screenplayToolbarPaperRowMaxHeightPx)
   * and its width is `816 * zoom` plus fixed insets — so fitting against it is self-referential: the
   * width branch reduces to `(816 * zoom - 10) / 816`, i.e. always just under the current zoom, so
   * every auto-fit pass ratchets zoom down and it can never grow back to fill the column. Measuring
   * the column instead is zoom-independent, so this is a true fit with a stable fixed point, and a
   * height-limited fit lands the page's bottom edge exactly on the column's (== the side nav's).
   *
   * No reserved top/bottom bleed (screenplayWorkspace.css no longer pads the scroll inner) — the page
   * fits the full column height, flush at both scroll extremes.
   */
  const calcAutoFitZoomToColumn = React.useCallback((colEl: HTMLElement): number => {
    // <PROTECTED>
    const cs = getComputedStyle(colEl)
    const padTop = parseFloat(cs.paddingTop) || 0
    const padBottom = parseFloat(cs.paddingBottom) || 0
    const padLeft = parseFloat(cs.paddingLeft) || 0
    const padRight = parseFloat(cs.paddingRight) || 0
    // clientHeight/clientWidth include padding; the toolbar + paper row lives in the content box.
    const availableHeight = colEl.clientHeight - padTop - padBottom
    // Everything the row spends on chrome beside the paper itself — mirrors
    // `screenplayToolbarPaperRowMinWidthPx`. Left is 0: the vertical toolbar is the left boundary.
    const availableWidth =
      colEl.clientWidth -
      padLeft -
      padRight -
      SCREENPLAY_VERTICAL_TOOLBAR_W_PX -
      SCREENPLAY_WORKSPACE_SCROLL_INNER_PAD_RIGHT_PX -
      SCREENPLAY_STAGE_RIM_HORIZONTAL_OUTSET_PX
    const targetScale = Math.min(
      availableHeight / SCREENPLAY_PAPER_HEIGHT_PX,
      availableWidth / SCREENPLAY_PAPER_WIDTH_PX,
    )
    return Math.min(SCREENPLAY_ZOOM_MAX, Math.max(SCREENPLAY_ZOOM_MIN, targetScale))
    // </PROTECTED>
  }, [])

  /**
   * The fit above, capped at `SCREENPLAY_DISPLAY_SCALE` — the paper's preferred on-screen size, and
   * what `screenplayPaperLayout.ts` already documents as "the cap and reset target for the auto-fit
   * zoom in WritualEditor" (the raw fit clamps to `SCREENPLAY_ZOOM_MAX` instead, so that intent had
   * drifted out of the code).
   *
   * Without the cap, a tall window grows the page until it fills the column exactly, so there is by
   * definition never room for the next page. Capped, the page stops at its preferred size and the
   * column's remaining height goes to the top of the following page, while the toolbar + paper row
   * still stretches the full column (see `screenplayToolbarPaperRowMaxHeightPx`). Short windows are
   * unaffected — the fit is below the cap there, so the page still shrinks to fit.
   */
  const calcAutoFitZoom = React.useCallback(
    (colEl: HTMLElement): number =>
      Math.min(SCREENPLAY_DISPLAY_SCALE, calcAutoFitZoomToColumn(colEl)),
    [calcAutoFitZoomToColumn],
  )

  /** Apply auto-fit zoom as soon as the column mounts (before paint). */
  React.useLayoutEffect(() => {
    // <PROTECTED>
    const colEl = editorColRef.current
    if (!colEl) return
    const fitted = calcAutoFitZoom(colEl)
    setZoom(fitted)
    isAutoZoomedRef.current = true
    setIsAutoZoomed(true)
    if (fitted <= SCREENPLAY_ZOOM_MIN + 0.001) {
      setAutoZoomSnackbarOpen(true)
    }
    // </PROTECTED>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorColEl]) // runs once per column mount — `editorColEl` only ever goes null → node


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

  /** Reapply auto-fit whenever the editor column resizes, as long as the user hasn't overridden zoom. */
  React.useEffect(() => {
    // <PROTECTED>
    const colEl = editorColRef.current
    if (!colEl) return
    const ro = new ResizeObserver(() => {
      if (!isAutoZoomedRef.current) return
      setZoom(calcAutoFitZoom(colEl))
    })
    ro.observe(colEl)
    // </PROTECTED>
    return () => { ro.disconnect() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcAutoFitZoom, editorColEl]) // calcAutoFitZoom is stable; re-observe when the column mounts

  /**
   * Track the editor column's content-box height so the toolbar + paper row can be sized to the
   * COLUMN instead of to one page (see `screenplayToolbarPaperRowMaxHeightPx`). This is the same
   * `availableHeight` `calcAutoFitZoom` derives; it is measured again here rather than shared
   * because that block is PROTECTED. Layout effect + ResizeObserver so the height lands before
   * paint, matching how `zoom` is applied.
   */
  React.useLayoutEffect(() => {
    const colEl = editorColRef.current
    if (!colEl) return
    const measure = () => {
      const cs = getComputedStyle(colEl)
      const padTop = parseFloat(cs.paddingTop) || 0
      const padBottom = parseFloat(cs.paddingBottom) || 0
      setEditorColContentHeightPx(colEl.clientHeight - padTop - padBottom)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(colEl)
    return () => { ro.disconnect() }
  }, [editorColEl])

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
   * Mirrors pagination into the live-pages store (toolbar count) and the writing tracker.
   * Placed after `useEditor` so `editorReady` can gate it: `pageRef` is attached inside the tree
   * this component only renders once `editor` resolves, so the hook must re-run at that point.
   */
  useSyncWritingTrackerPageCount({
    pageRef,
    projectId,
    trackerEnabled: writingTracker?.enabled === true,
    canEdit,
    editorReady: editor != null,
  })

  /**
   * Local paint cache: writes the window of pages around the reader's scroll position so the next
   * refresh can show them immediately, restores that position once the real pages are paginated,
   * and reports when the load curtain below can come down.
   */
  const { paginationReady } = useScreenplaySnapshotPersistence({
    // Keyed per screenplay document: two documents in one project paint different pages, so a
    // shared key would restore one document's scroll position into the other.
    projectId: screenplaySnapshotKey(projectId, documentId),
    workspaceRef,
    pageRef,
    editorReady: editor != null,
    editor,
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

  /**
   * Apply a just-imported script to the editor that is already on screen.
   *
   * Seeding below runs once per mount, and replacing a document's content changes neither the
   * selected document nor the editor's key — so without this the writer keeps looking at the script
   * the editor loaded when they arrived. Going through `setContent` (rather than remounting) also
   * means that under collaboration the import propagates as a normal edit: connected clients get it,
   * and it is what gets persisted, instead of the stale in-memory Y.Doc overwriting the import.
   */
  const pendingImport = useScreenplayDocumentsStore((s) =>
    projectId ? s.pendingImportByProject[projectId] : undefined,
  )
  const consumeImportedContent = useScreenplayDocumentsStore((s) => s.consumeImportedContent)
  const appliedImportTokenRef = React.useRef(0)

  React.useEffect(() => {
    if (!editor || !projectId || !pendingImport) return
    if (pendingImport.documentId !== documentId) return
    if (appliedImportTokenRef.current === pendingImport.token) return

    appliedImportTokenRef.current = pendingImport.token
    editor.commands.setContent(pendingImport.doc as never)
    consumeImportedContent(projectId, pendingImport.documentId)
  }, [editor, projectId, documentId, pendingImport, consumeImportedContent])

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
    documentId,
    onPending: () => setPending(true),
    onSaveStart: startSaving,
    onSaveEnd: (success) => {
      endSaving(success)
      if (success && projectId) {
        void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
        void queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, projectId] })
        void queryClient.invalidateQueries({
          queryKey: [SCREENPLAY_DOCUMENTS_QUERY_KEY, projectId],
        })
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
              const colEl = editorColRef.current
              if (!colEl) return
              isAutoZoomedRef.current = true
              setIsAutoZoomed(true)
              setZoom(calcAutoFitZoom(colEl))
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
   * The toolbar + workspace row fills the editor column's full height: the vertical toolbar then
   * always scales down to the bottom of the column — i.e. flush with the bottom of the side nav —
   * and whatever space is left below a full page shows as much of the next page as fits.
   *
   * Height itself comes from the flex chain (`flex: 1 1 auto` in `screenplayWorkspace.css` plus the
   * row's own `height: 100%`); this cap is held at the measured column height purely so it can
   * never clip that. Capping at one page's on-screen height (`1056 * zoom`) instead is what left a
   * gap under the row whenever the auto-fit was width-limited, zoom was capped or the user had
   * zoomed out — the page shrank with `zoom` while the column kept growing with the window.
   *
   * Before the first measurement, fall back to one page — the auto-fit's own starting assumption.
   */
  const screenplayToolbarPaperRowMaxHeightPx =
    editorColContentHeightPx ?? Math.ceil(SCREENPLAY_PAPER_HEIGHT_PX * zoom)

  /** Tiptap not resolved yet — keep the cached pages on screen rather than flashing empty. */
  if (!editor) return <ScreenplayInstantPreview projectId={projectId} documentId={documentId} />

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
          // Containing block for the load curtain below.
          position: 'relative',
        }}
      >
        {/* Cached pages stay on top until PageBreakPlugin has laid the real ones out, so the
            document never appears mid-repagination. Not editable and never saved. */}
        {!paginationReady && (
          <ScreenplayInstantPreview
            projectId={projectId}
            documentId={documentId}
            variant="absolute"
          />
        )}

        {/* Fills remaining row width, centering the editor column */}
        <Box
          ref={attachEditorColRef}
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
