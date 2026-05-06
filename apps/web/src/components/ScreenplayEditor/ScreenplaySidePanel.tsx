import * as React from 'react'
import {
  Box,
  ButtonBase,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import LocalMoviesIcon from '@mui/icons-material/LocalMovies'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PersonIcon from '@mui/icons-material/Person'
import { SceneCard } from '@/components/SceneCard'
import { CharacterCard } from '@/components/CharacterCard'
import { SCREENPLAY_FLOATING_SURFACE_SHADOW } from './screenplayPaperLayout'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneVersion {
  sceneHeading?: string
  version?: number
  step?: string
  act?: number
}

export interface ProjectScene {
  _id: string
  activeVersion?: number
  lockedVersion?: number | null
  versions?: SceneVersion[]
}

export interface SceneCardStepOption {
  name: string
  number: number
  act: string
}

interface ProjectCharacter {
  _id: string
  name?: string
  imageUrl?: string
  details?: any[]
  lockedVersion?: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Vertical Scenes / Characters tabs on the left edge of the screenplay area. */
const SIDE_PANEL_TABS_W_PX = 35

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScreenplaySidePanelProps {
  /** Controls the outer wrapper's flex proportion (true = expanded list visible). */
  navigatorSplitProportions: boolean
  sidePanelTab: 'scenes' | 'characters'
  onTabChange: (tab: 'scenes' | 'characters') => void
  sidePanelExpanded: boolean
  onExpandedChange: (expanded: boolean) => void
  characterCardExpandedId: number | undefined
  onCharacterCardExpandedChange: (id: number | undefined) => void
  projectScenes: ProjectScene[]
  projectCharacters: ProjectCharacter[]
  projectId: string | undefined
  sceneCardSteps: SceneCardStepOption[]
  onToggleCharacterLock: (characterId: string, locked: boolean) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScreenplaySidePanel({
  navigatorSplitProportions,
  sidePanelTab,
  onTabChange,
  sidePanelExpanded,
  onExpandedChange,
  characterCardExpandedId,
  onCharacterCardExpandedChange,
  projectScenes,
  projectCharacters,
  projectId,
  sceneCardSteps,
  onToggleCharacterLock,
}: ScreenplaySidePanelProps) {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignSelf: 'stretch',
        minHeight: 0,
        minWidth: 0,
        ...(navigatorSplitProportions ? { flex: '1 1 0%' } : { flex: '0 0 auto' }),
      }}
    >
      {/* ── Tab rail ──────────────────────────────────────────────────── */}
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
                onClick={() => onTabChange(id)}
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
                  bgcolor: selected ? 'background.default' : 'transparent',
                  border: (t) => `1px solid ${t.palette.divider}`,
                  boxShadow: 'none',
                  transition: (t) =>
                    t.transitions.create(['background-color', 'color'], {
                      duration: t.transitions.duration.shorter,
                    }),
                  '&:hover': {
                    bgcolor: selected ? 'background.default' : 'action.hover',
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
                  <Icon sx={{ fontSize: 18, color: selected ? 'text.primary' : 'text.secondary' }} />
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

        {/* ── Expand / collapse toggle ──────────────────────────────── */}
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            py: 1,
          }}
        >
          {sidePanelExpanded ? (
            <Tooltip title="Hide list">
              <IconButton
                size="small"
                onClick={() => onExpandedChange(false)}
                aria-label="Hide list"
                aria-expanded
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Show list">
              <IconButton
                size="small"
                onClick={() => onExpandedChange(true)}
                aria-label="Show list"
                aria-expanded={false}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Expanded list panel ───────────────────────────────────────── */}
      {sidePanelExpanded && (
        <Paper
          className="screenplay-navigator"
          elevation={0}
          sx={{
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignSelf: 'stretch',
            flex: '1 1 0%',
            minWidth: 0,
            border: 'none',
            borderRadius: 2,
            overflow: 'hidden',
            transition: theme.transitions.create(['box-shadow', 'border-color'], {
              duration: theme.transitions.duration.shorter,
            }),
          }}
        >
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            {sidePanelTab === 'scenes' && (
              <>
                {projectScenes.length === 0 ? (
                  <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.disabled">
                      No scenes in your outline yet.
                      <br />
                      Add scenes in the Outline tab to see them here.
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 1,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
                        <Box
                          key={scene._id ?? i}
                          sx={{
                            minWidth: 0,
                            width: '100%',
                            '& > .MuiCard-root': { mb: 0 },
                          }}
                        >
                          <SceneCard
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
                            compactSideBySide
                          />
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </>
            )}

            {sidePanelTab === 'characters' && (
              <>
                {projectCharacters.length === 0 ? (
                  <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.disabled">
                      No characters yet.
                      <br />
                      Add characters on the Characters page.
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      p: 1,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 1,
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    {projectCharacters.map((character, index) => {
                      const cardId = index + 1
                      return (
                        <Box
                          key={character._id ?? `character-${index}`}
                          sx={{
                            minWidth: 0,
                            width: '100%',
                            '& > .MuiCard-root': { mb: 0 },
                          }}
                        >
                          <CharacterCard
                            id={cardId}
                            name={character.name}
                            imageUrl={character.imageUrl}
                            details={character.details}
                            expanded={characterCardExpandedId === cardId}
                            onExpandClick={() =>
                              onCharacterCardExpandedChange(
                                characterCardExpandedId === cardId ? undefined : cardId,
                              )
                            }
                            locked={character.lockedVersion != null}
                            onToggleLock={() =>
                              onToggleCharacterLock(character._id, character.lockedVersion == null)
                            }
                            fullWidthInParent
                          />
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  )
}
