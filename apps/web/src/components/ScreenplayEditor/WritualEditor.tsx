'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'
import PrintIcon from '@mui/icons-material/Print'
import ArticleIcon from '@mui/icons-material/Article'
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
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries'
import { PROJECT_SCENES_QUERY_KEY } from 'hooks'
import { useUserProfileStore } from '@/state/user'
import { GRAPHQL_ENDPOINT } from '@/lib/config'
import './Screenplay.css'

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

const ELEMENT_ICONS: Record<ScreenplayElementType, React.ReactNode> = {
  slugline:      <LocalMoviesIcon sx={{ fontSize: 14 }} />,
  action:        <NotesIcon sx={{ fontSize: 14 }} />,
  character:     <PersonIcon sx={{ fontSize: 14 }} />,
  parenthetical: <FormatQuoteIcon sx={{ fontSize: 14 }} />,
  dialogue:      <ChatBubbleOutlineIcon sx={{ fontSize: 14 }} />,
  transition:    <FastForwardIcon sx={{ fontSize: 14 }} />,
}

const ELEMENT_ORDER: ScreenplayElementType[] = [
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
const ELEMENT_SHORTCUTS: Record<ScreenplayElementType, string> = {
  slugline:      'Tab ×2 from Action',
  action:        'Tab ×1  ·  Enter after Dialogue or Scene Heading',
  character:     'Tab ×3 from Action',
  parenthetical: 'Tab ×4  ·  Enter after Character',
  dialogue:      'Tab ×5  ·  Enter after Character or Parenthetical',
  transition:    'Click to set  (not in Tab cycle)',
}

// ─── Tooltip content component ────────────────────────────────────────────────

function ElementTooltipContent({ type }: { type: ScreenplayElementType }) {
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

function countWords(doc: Record<string, unknown>): number {
  let count = 0
  const recurse = (nodes: Array<Record<string, unknown>>) => {
    for (const node of nodes) {
      if (node.type === 'text' && typeof node.text === 'string') {
        count += (node.text as string).trim().split(/\s+/).filter(Boolean).length
      }
      if (node.content) recurse(node.content as Array<Record<string, unknown>>)
    }
  }
  recurse((doc?.content as Array<Record<string, unknown>>) ?? [])
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
 * Open a popup containing only the screenplay HTML and trigger the print
 * dialog. Uses @page for proper 8.5"×11" paper with standard screenplay
 * margins — no app chrome, sidebar, or nav bars appear in the printout.
 */
function printScreenplay(html: string) {
  const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
  if (!win) {
    console.warn('Popup blocked — please allow popups for this site to print.')
    return
  }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Screenplay</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
  @page {
    size: 8.5in 11in;
    /* Standard screenplay margins: 1.5" left, 1" all others */
    margin: 1in 1in 1in 1.5in;
  }
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
    margin: 0 0 12pt 0;
    padding: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .script-block:last-child { margin-bottom: 0; }

  /* Scene Heading — full width, bold, uppercase */
  .script-block[data-element-type="slugline"] {
    text-transform: uppercase;
    font-weight: 700;
    margin-top: 24pt;
    margin-bottom: 12pt;
    break-after: avoid;
    page-break-after: avoid;
  }
  .script-block[data-element-type="slugline"]:first-child { margin-top: 0; }

  /* Character — 3.5" from paper left; @page left margin is 1.5" → 2.0" indent */
  .script-block[data-element-type="character"] {
    margin-left: 2.0in;
    text-transform: uppercase;
    margin-bottom: 0;
    break-after: avoid;
    page-break-after: avoid;
  }

  /* Parenthetical — 3.0" from paper left → 1.5" indent */
  .script-block[data-element-type="parenthetical"] {
    margin-left: 1.5in;
    margin-right: 1.5in;
    margin-bottom: 0;
    break-before: avoid;
    break-after: avoid;
    page-break-before: avoid;
    page-break-after: avoid;
  }

  /* Dialogue — 2.5" from paper left → 1.0" indent; 3.5" wide → 1.5" right */
  .script-block[data-element-type="dialogue"] {
    margin-left: 1.0in;
    margin-right: 1.5in;
    margin-bottom: 12pt;
    break-before: avoid;
    page-break-before: avoid;
  }

  /* Transition — right-aligned, uppercase */
  .script-block[data-element-type="transition"] {
    text-align: right;
    text-transform: uppercase;
    margin-top: 12pt;
    margin-bottom: 12pt;
  }
</style>
</head>
<body>${html}</body>
</html>`)

  win.document.close()

  // Let the Google Font load before printing so Courier Prime renders correctly
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

// ─── Component ────────────────────────────────────────────────────────────────

export function WritualEditor({ projectId }: WritualEditorProps) {
  const theme = useTheme()
  const [navigatorOpen, setNavigatorOpen] = React.useState(true)
  const [activeType, setActiveType] = React.useState<ScreenplayElementType>('action')
  const [wordCount, setWordCount] = React.useState(0)

  // Seed editor content exactly once after scenes load
  const seededRef = React.useRef(false)

  // ── Fetch project scenes from the outline ────────────────────────────────
  const user = useUserProfileStore((s) => s.userProfile?.user)

  const { data: scenesData, isLoading: scenesLoading } = useQuery({
    queryKey: [PROJECT_SCENES_QUERY_KEY, projectId],
    queryFn: async () =>
      request(GRAPHQL_ENDPOINT, PROJECT_SCENES_QUERY, {
        input: { user, _id: projectId },
      }),
    enabled: Boolean(projectId && user),
  }) as { data: any; isLoading: boolean }

  const projectScenes: ProjectScene[] =
    (scenesData as any)?.getProjectData?.[0]?.scenes ?? []

  // ── Editor ───────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
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
      }),
      ScriptBlock,
    ],
    content: {
      type: 'doc',
      content: [{ type: 'scriptBlock', attrs: { elementType: 'action' }, content: [] }],
    },
    autofocus: 'end',
    immediatelyRender: false,
  })

  // ── Seed editor from outline scenes (once) ───────────────────────────────
  React.useEffect(() => {
    if (!editor || seededRef.current || scenesLoading) return
    seededRef.current = true

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

    editor.commands.setContent(doc)
  }, [editor, projectScenes, scenesLoading])

  // ── Sync active type + word count ────────────────────────────────────────
  React.useEffect(() => {
    if (!editor) return
    const sync = () => {
      const { $from } = editor.state.selection
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth)
        if (node.type.name === 'scriptBlock') {
          setActiveType((node.attrs.elementType as ScreenplayElementType) ?? 'action')
          break
        }
      }
      setWordCount(countWords(editor.getJSON()))
    }
    editor.on('selectionUpdate', sync)
    editor.on('update', sync)
    sync()
    return () => { editor.off('selectionUpdate', sync); editor.off('update', sync) }
  }, [editor])

  // ── Toolbar type change ──────────────────────────────────────────────────
  const handleTypeChange = React.useCallback(
    (_: React.MouseEvent, newType: ScreenplayElementType | null) => {
      if (!newType || !editor) return
      editor.chain().focus().setElementType(newType).run()
    },
    [editor]
  )

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

        {/* Format buttons — each tooltip shows label + keyboard shortcut */}
        <ToggleButtonGroup
          value={activeType}
          exclusive
          onChange={handleTypeChange}
          size="small"
          aria-label="screenplay element type"
        >
          {ELEMENT_ORDER.map((type) => (
            <Tooltip
              key={type}
              title={<ElementTooltipContent type={type} />}
              arrow
              placement="bottom"
            >
              <span>
                <ToggleButton
                  value={type}
                  aria-label={SCREENPLAY_ELEMENT_LABELS[type]}
                  sx={{
                    gap: 0.5,
                    px: 1.25,
                    py: 0.5,
                    textTransform: 'none',
                    fontSize: '0.7rem',
                    fontWeight: activeType === type ? 700 : 400,
                    lineHeight: 1.2,
                    minWidth: 0,
                  }}
                >
                  {ELEMENT_ICONS[type]}
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    {SCREENPLAY_ELEMENT_LABELS[type]}
                  </Box>
                </ToggleButton>
              </span>
            </Tooltip>
          ))}
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Chip
          size="small"
          label={SCREENPLAY_ELEMENT_LABELS[activeType]}
          icon={<ArticleIcon />}
          variant="outlined"
          color="primary"
          sx={{ fontFamily: 'monospace', fontSize: '0.7rem', display: { xs: 'none', md: 'flex' } }}
        />

        <Box sx={{ flex: 1, minWidth: 8 }} />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' }, fontFamily: 'monospace', whiteSpace: 'nowrap' }}
        >
          {wordCount.toLocaleString()} words · ~{pages}p
        </Typography>

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
              {scenesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : projectScenes.length === 0 ? (
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
          <Box className="screenplay-page">
            <EditorContent editor={editor} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
