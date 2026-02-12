'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  useTheme,
} from '@mui/material';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { ProjectDetailsLayout } from '@/components/ProjectDetailsLayout';
import { SceneCard } from '@/components/SceneCard';
import AddIcon from '@mui/icons-material/Add';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PROJECT_SCENES_QUERY } from '@/queries/SceneQueries';
import { OUTLINE_FRAMEWORKS_QUERY } from '@/queries/OutlineQueries';
import { useProjectSceneMutations, PROJECT_SCENES_QUERY_KEY } from 'hooks';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import { useOutlineSaveStatusStore } from '@/state/outlineSaveStatus';
import type { OutlineFrameworkItem } from '@/state/outlineFrameworks';

const endpoint = GRAPHQL_ENDPOINT;

const DEFAULT_NEW_SCENE_VERSION = {
  version: 1,
  sceneHeading: '',
  thesis: '',
  antithesis: '',
  synthesis: '',
  synopsis: '',
  act: 1,
};

/** Parse act string (e.g. "ACT I") to number 1, "ACT II" to 2, etc. */
function parseActToNumber(actStr: string | undefined): number | null {
  if (!actStr) return null;
  const normalized = String(actStr).toUpperCase().trim();
  const match = normalized.match(/ACT\s*(I{1,3}|IV|V|\d+)/i) || normalized.match(/^([IVXLCDM]+|\d+)$/i);
  if (!match) return null;
  const val = match[1];
  const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  if (roman[val.toUpperCase()] != null) return roman[val.toUpperCase()];
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

/** Build Act -> Steps structure and group scenes by act/step */
function buildActStepStructure(
  framework: OutlineFrameworkItem | null,
  scenes: any[]
): {
  actSteps: { act: string; actNum: number; steps: { name: string; number: number }[] }[];
  stepKeyToScenes: Map<string, any[]>;
  unassignedScenes: any[];
} {
  const actSteps: { act: string; actNum: number; steps: { name: string; number: number }[] }[] = [];
  const stepKeyToScenes = new Map<string, any[]>();
  const unassignedScenes: any[] = [];

  if (!framework?.format?.steps?.length) {
    return { actSteps, stepKeyToScenes, unassignedScenes };
  }

  const steps = framework.format.steps;
  const actMap = new Map<number, { act: string; steps: { name: string; number: number }[] }>();

  for (const s of steps) {
    const actStr = s.act ?? '';
    const actNum = parseActToNumber(actStr) ?? 1;
    const stepName = (s.name ?? '').trim() || `Step ${s.number ?? 0}`;
    const stepNum = s.number ?? 0;

    if (!actMap.has(actNum)) {
      actMap.set(actNum, { act: actStr || `ACT ${actNum}`, steps: [] });
    }
    const entry = actMap.get(actNum)!;
    entry.steps.push({ name: stepName, number: stepNum });
    stepKeyToScenes.set(`${actNum}:${stepName}`, []);
  }

  const sortedActs = Array.from(actMap.entries()).sort((a, b) => a[0] - b[0]);
  for (const [actNum, { act, steps: sts }] of sortedActs) {
    actSteps.push({ act, actNum, steps: sts.sort((a, b) => a.number - b.number) });
  }

  for (const scene of scenes) {
    const activeVersion = scene.activeVersion ?? 1;
    const idx = Math.max(0, activeVersion - 1);
    const v = scene.versions?.[idx];
    const sceneActNum = v?.act != null && Number.isFinite(Number(v.act)) ? Number(v.act) : null;
    const sceneStepName = (v?.step ?? '').trim();

    console.log('Build act step structure: ', { sceneActNum, sceneStepName, versions: v });

    let placed = false;
    if (sceneActNum != null) {
      const exactKey = `${sceneActNum}:${sceneStepName}`;
      const exactBucket = stepKeyToScenes.get(exactKey);
      console.log('exactBucket: ', exactBucket);
      console.log('exactKey sceneActNum:sceneStepName:', exactKey);
      if (exactBucket) {
        console.log(`exactBucket found: ${{exactBucket, adding: scene}}`);
        exactBucket.push(scene);
        placed = true;
      }
      if (!placed && !sceneStepName) {
        unassignedScenes.push(scene);
      }
    }
  
  }

  return { actSteps, stepKeyToScenes, unassignedScenes };
}

export default function OutlinePage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { createSceneMutation } = useProjectSceneMutations();
  const { savingCount, lastSavedAt, reset } = useOutlineSaveStatusStore();
  const isSaving = savingCount > 0;
  const showSaved = !isSaving && lastSavedAt != null;

  React.useEffect(() => {
    return () => reset();
  }, [id, reset]);

  const getOutlines = async () => {
    const userProfileState = await useUserProfileStore.getState();
    const user = userProfileState.userProfile?.user;
    const variables = { input: { user, _id: id } };
    return request(endpoint, PROJECT_SCENES_QUERY, variables);
  };

  const { data }: any = useQuery({
    queryKey: [PROJECT_SCENES_QUERY_KEY, id],
    queryFn: getOutlines,
    enabled: Boolean(id),
  });

  const project = data?.getProjectData?.[0];
  const scenes = project?.scenes ?? [];
  const outlineName = project?.outlineName?.trim() || null;
  const user = project?.user;

  const { data: frameworksData }: any = useQuery({
    queryKey: ['outline-frameworks', user],
    queryFn: async () => {
      if (!user) return { getOutlineFrameworks: [] };
      return request(endpoint, OUTLINE_FRAMEWORKS_QUERY, { user });
    },
    enabled: Boolean(outlineName && user),
  });

  const framework: OutlineFrameworkItem | null = React.useMemo(() => {
    const list = frameworksData?.getOutlineFrameworks ?? [];
    return list.find((f: any) => (f.name ?? '').trim() === outlineName) ?? null;
  }, [frameworksData, outlineName]);

  const { actSteps, stepKeyToScenes, unassignedScenes } = React.useMemo(
    () => buildActStepStructure(framework, scenes),
    [framework, scenes]
  );

  // Extract all steps from the framework for the dropdown
  const allSteps = React.useMemo(() => {
    if (!framework?.format?.steps?.length) return [];
    return framework.format.steps.map((s: any) => ({
      name: (s.name ?? '').trim() || `Step ${s.number ?? 0}`,
      number: s.number ?? 0,
      act: s.act ?? '',
    }));
  }, [framework]);

  const useFrameworkView = Boolean(outlineName && framework);

  const [newSceneAnchorEl, setNewSceneAnchorEl] = React.useState<null | HTMLElement>(null);
  const newSceneMenuOpen = Boolean(newSceneAnchorEl);

  const handleNewSceneClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setNewSceneAnchorEl(event.currentTarget);
  };

  const handleNewSceneMenuClose = () => {
    setNewSceneAnchorEl(null);
  };

  const handleNewScene = (stepName?: string) => {
    if (!id) return;
    handleNewSceneMenuClose();
    const initialVersion = {
      ...DEFAULT_NEW_SCENE_VERSION,
      ...(stepName != null && stepName !== '' ? { step: stepName } : {}),
    };
    createSceneMutation.mutate(
      {
        _id: id,
        versions: [initialVersion],
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, id] });
          await queryClient.refetchQueries({ queryKey: [PROJECT_SCENES_QUERY_KEY, id] });
        },
      }
    );
  };

  const renderSceneCard = (scene: any, index: number) => {
    const activeVersion = scene.activeVersion ?? 1;
    const activeVersionIndex = Math.max(0, activeVersion - 1);
    const activeVersionData = scene.versions?.[activeVersionIndex];
    return (
      <SceneCard
        key={scene.number ?? index}
        number={scene.number}
        newScene={false}
        versions={scene.versions ?? []}
        activeVersion={activeVersion}
        lockedVersion={scene.lockedVersion ?? null}
        projectId={id}
        step={activeVersionData?.step ?? ''}
        act={activeVersionData?.act}
        steps={allSteps}
      />
    );
  };

  console.log({ actSteps, stepKeyToScenes, unassignedScenes });

  return (
    <ProjectDetailsLayout contentSx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight={600}>Outline</Typography>
          {isSaving && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} aria-label="Saving">
              <AutorenewIcon sx={{ fontSize: 20, animation: 'spin 1s linear infinite' }} />
              <Typography variant="body2" color="text.secondary">saving...</Typography>
            </Box>
          )}
          {showSaved && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} aria-label="Saved">
              <CloudDoneIcon sx={{ fontSize: 20, color: 'success.main' }} />
            </Box>
          )}
        </Box>
        {allSteps.length > 0 ? (
          <>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleNewSceneClick}
              disabled={createSceneMutation.isPending}
              aria-controls={newSceneMenuOpen ? 'new-scene-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={newSceneMenuOpen ? 'true' : undefined}
            >
              New scene
            </Button>
            <Menu
              id="new-scene-menu"
              anchorEl={newSceneAnchorEl}
              open={newSceneMenuOpen}
              onClose={handleNewSceneMenuClose}
              MenuListProps={{ 'aria-labelledby': 'new-scene-button' }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => handleNewScene()}
              >
                Assign to Step
              </MenuItem>
              {allSteps.map((stepOption) => (
                <MenuItem
                  key={`${stepOption.act}-${stepOption.name}`}
                  onClick={() => handleNewScene(stepOption.name)}
                >
                  {stepOption.name}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleNewScene()}
            disabled={createSceneMutation.isPending}
          >
            New scene
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {useFrameworkView ? (
          <>
            {actSteps.map(({ act, actNum, steps }) => (
              <Accordion
                key={act}
                defaultExpanded
                disableGutters
                sx={{
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': { margin: 0 },
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: theme.palette.background.default,
                    border: '1px solid',
                    borderColor: theme.palette.divider,
                    borderRadius: '8px',
                    mb: 1
                  }}
                >
                  <Typography fontWeight={600}>Act {act}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ mb: 1, pt: 0, border: '1px solid', borderColor: theme.palette.divider, borderRadius: '8px' }}>
                  {steps.map((st) => {
                    const key = `${actNum}:${st.name}`;
                    const stepScenes = stepKeyToScenes.get(key) ?? [];
                    return (
                      <Accordion
                        key={key}
                        defaultExpanded
                        disableGutters
                        sx={{
                          boxShadow: 'none',
                          '&:before': { display: 'none' },
                          '&.Mui-expanded': { margin: 0 },
                        }}
                      >
                        <AccordionSummary 
                          expandIcon={<ExpandMoreIcon />}
                        >
                          <Typography variant="body2" fontWeight={500}>
                            STEP {st.number}: {st.name}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'row',
                              flexWrap: 'wrap',
                              gap: 2,
                              containerType: 'inline-size',
                            }}
                          >
                            {stepScenes.map((scene: any, idx: number) => renderSceneCard(scene, idx))}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </AccordionDetails>
              </Accordion>
            ))}
            {unassignedScenes.length > 0 && (
              <Accordion
                defaultExpanded
                disableGutters
                sx={{
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': { margin: 0 },
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  
                    sx={{
                      backgroundColor: theme.palette.background.default,
                      border: '1px solid',
                      borderColor: theme.palette.divider,
                      borderRadius: '8px',
                      mb: 1
                    }}
                  
                >
                  <Typography fontWeight={600}>Unassigned</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ mb: 1, pt: 2, border: '1px solid', borderColor: theme.palette.divider, borderRadius: '8px' }} >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 2,
                      containerType: 'inline-size',
                    }}
                  >
                    {unassignedScenes.map((scene: any, idx: number) => renderSceneCard(scene, idx))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'flex-start',
              flexWrap: 'wrap',
              gap: 2,
              containerType: 'inline-size',
            }}
          >
            {scenes.map((scene: any, index: number) => renderSceneCard(scene, index))}
          </Box>
        )}
      </Box>
    </ProjectDetailsLayout>
  );
}
