import React, { useEffect, useMemo, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { sceneCardStyle, multiLineTruncate } from 'styles';
import {
  Box,
  Chip,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import DeleteIcon from '@mui/icons-material/Delete';
import { useProjectSceneMutations } from 'hooks';
import { VersionSelectorWithAdd } from '@/components/VersionSelectorWithAdd/VersionSelectorWithAdd';
import { useOutlineSaveStatusStore } from '@/state/outlineSaveStatus';

const SAVE_DEBOUNCE_MS = 2000;

interface StepOption {
  name: string;
  number: number;
  act: string;
}

interface SceneCardProps {
  sceneId: string;
  number: number;
  newScene?: boolean;
  versions: any[];
  activeVersion?: number | null;
  lockedVersion?: number | null;
  act?: number;
  projectId?: string;
  step?: string;
  steps?: StepOption[];
  onDelete?: () => void;
  /**
   * Use in narrow parents (e.g. screenplay scene strip): 100% width, auto height,
   * no outline grid / min-450px constraints.
   */
  fullWidthInParent?: boolean;
  /** Tighter padding and content height when shown two-per-row (e.g. screenplay side panel). */
  compactSideBySide?: boolean;
}

export const SceneCard = React.memo<SceneCardProps>(function SceneCard({
  sceneId,
  number,
  newScene = false,
  versions,
  activeVersion,
  lockedVersion,
  act,
  projectId,
  step,
  steps = [],
  onDelete,
  fullWidthInParent = false,
  compactSideBySide = false,
}) {
  const sideBySideCompact = fullWidthInParent && compactSideBySide;
  const initialActiveVersion = Math.max(1, Number(activeVersion ?? 1));
  const [activeVersionLocal, setActiveVersionLocal] = useState<number>(initialActiveVersion);
  const [creatingNewVersion, setCreatingNewVersion] = useState(false);
  const [sceneContent, setSceneContent] = useState<any>({
    thesis: '',
    antithesis: '',
    synthesis: '',
    synopsis: '',
    sceneHeading: '',
  });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef(false);
  const latestContentRef = useRef<any>({});
  const saveMetaRef = useRef<{ version: number; newVersion: boolean;}>({
    version: initialActiveVersion,
    newVersion: false,
  });
  const versionsRef = useRef<any[]>(versions ?? []);
  const { updateSceneMutation, deleteSceneMutation } = useProjectSceneMutations();
  const { startSaving, endSaving } = useOutlineSaveStatusStore();
  const theme = useTheme();
  const [isLocked, setIsLocked] = useState(lockedVersion != null);

  useEffect(() => {
    versionsRef.current = Array.isArray(versions) ? versions : [];
  }, [versions]);

  // Keep local active/locked in sync with props (e.g. after refetch)
  useEffect(() => {
    const nextActive = Math.max(1, Number(activeVersion ?? 1));
    setActiveVersionLocal(nextActive);
  }, [activeVersion]);

  useEffect(() => {
    setIsLocked(lockedVersion != null);
  }, [lockedVersion]);



  // Load content for current active version (or blank for new version draft)
  useEffect(() => {
    if (creatingNewVersion) {
      setSceneContent({
        thesis: '',
        antithesis: '',
        synthesis: '',
        synopsis: '',
        sceneHeading: '',
      });
      return;
    }
    const idx = Math.max(0, activeVersionLocal - 1);
    const details = versionsRef.current[idx] ?? versionsRef.current[0];
    setSceneContent({
      version: details?.version ?? activeVersionLocal,
      thesis: details?.thesis ?? '',
      antithesis: details?.antithesis ?? '',
      synthesis: details?.synthesis ?? '',
      synopsis: details?.synopsis ?? '',
      sceneHeading: details?.sceneHeading ?? '',
      step: details?.step ?? step ?? '',
      act: details?.act ?? act ?? undefined,
    });
  }, [activeVersionLocal, creatingNewVersion, step, act, versions]);

  useEffect(() => {
    latestContentRef.current = sceneContent;
  }, [sceneContent]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const scheduleSave = () => {
    if (isLocked || !projectId) return;
    const versionToSave = activeVersionLocal || 1;
    saveMetaRef.current = {
      version: versionToSave,
      newVersion: creatingNewVersion
    };
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!saveInProgressRef.current) {
      saveInProgressRef.current = true;
      startSaving();
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const content = latestContentRef.current;
      const { version: versionToSaveInner, newVersion: newVersionInner } = saveMetaRef.current;
      const activeVersionIndex = Math.max(0, versionToSaveInner - 1);
      const baseVersion = versionsRef.current[activeVersionIndex] ?? {};
      const updatedVersion = {
        ...baseVersion,
        thesis: content.thesis ?? '',
        antithesis: content.antithesis ?? '',
        synthesis: content.synthesis ?? '',
        sceneHeading: content.sceneHeading ?? '',
        synopsis: content.synopsis ?? '',
        step: content.step ?? '',
        act: content.act ?? undefined,
        version: versionToSaveInner,
      };
      updateSceneMutation.mutate(
        {
          sceneId,
          projectId: projectId!,
          activeVersion: versionToSaveInner,
          lockedVersion: lockedVersion ?? undefined,
          newVersion: newVersionInner,
          versions: [updatedVersion],
        },
        {
          onSuccess: () => {
            if (newVersionInner) setCreatingNewVersion(false);
          },
          onSettled: (_, error) => {
            saveInProgressRef.current = false;
            endSaving(!error);
          },
        }
      );
    }, SAVE_DEBOUNCE_MS);
  };

  const handleContentChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setSceneContent((prev: any) => ({ ...prev, [key]: value }));
    scheduleSave();
  };

  const handleStepChange = (event: SelectChangeEvent<string>) => {
    if (isLocked || !projectId) return;
    const selectedStepName = event.target.value;
    
    // Update local state
    setSceneContent((prev: any) => ({ ...prev, step: selectedStepName }));
    
    // Immediately save the step change
    const versionToSave = activeVersionLocal || 1;
    const activeVersionIndex = Math.max(0, versionToSave - 1);
    const baseVersion = versionsRef.current[activeVersionIndex] ?? {};
    const currentContent = latestContentRef.current;
    const updatedVersion = {
      ...baseVersion,
      thesis: currentContent.thesis ?? '',
      antithesis: currentContent.antithesis ?? '',
      synthesis: currentContent.synthesis ?? '',
      synopsis: currentContent.synopsis ?? '',
      sceneHeading: currentContent.sceneHeading ?? '',
      step: selectedStepName,
      act: currentContent.act ?? act ?? undefined,
      version: versionToSave,
    };
    
    startSaving();
    updateSceneMutation.mutate(
      {
        sceneId,
        projectId: projectId!,
        activeVersion: versionToSave,
        lockedVersion: lockedVersion ?? undefined,
        newVersion: false,
        versions: [updatedVersion],
      },
      { onSettled: (_, error) => endSaving(!error) }
    );
  };

  const handleVersionChange = (event: SelectChangeEvent<string>) => {
    const next = parseInt(event.target.value, 10);
    handleVersionSelect(next);
  };

  const handleVersionSelect = (next: number) => {
    if (isLocked) return;
    if (!Number.isFinite(next) || next < 1) return;
    setCreatingNewVersion(false);
    setActiveVersionLocal(next);
    if (projectId) {
      startSaving();
      const idx = Math.max(0, next - 1);
      const baseVersion = versionsRef.current[idx] ?? {};
      updateSceneMutation.mutate(
        {
          sceneId,
          projectId: projectId!,
          activeVersion: next,
          newVersion: false,
          versions: [baseVersion],
        },
        { onSettled: (_, error) => endSaving(!error) }
      );
    }
  };

  const versionCount = (Array.isArray(versions) ? versions.length : 0) + (creatingNewVersion ? 1 : 0);
  const versionOptionsList = useMemo(() => {
    const count = Math.max(1, versionCount);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [versionCount]);
  const selectValue = String(activeVersionLocal);

  const handleAddVersionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked || !projectId) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const next = (Array.isArray(versions) ? versions.length : 0) + 1;
    setCreatingNewVersion(true);
    setActiveVersionLocal(next);
    const newVersionPayload = {
      version: next,
      sceneHeading: '',
      thesis: '',
      antithesis: '',
      synthesis: '',
      synopsis: '',
      step: step ?? '',
      act: act ?? undefined,
    };
    startSaving();
    updateSceneMutation.mutate(
      {
        sceneId,
        projectId: projectId!,
        activeVersion: next,
        newVersion: true,
        versions: [newVersionPayload],
      },
      {
        onSuccess: () => {
          setCreatingNewVersion(false);
        },
        onSettled: (_, error) => endSaving(!error),
      }
    );
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!projectId) return;
    const nextLocked = isLocked ? null : activeVersionLocal;
    setIsLocked(!isLocked);
    const idx = Math.max(0, activeVersionLocal - 1);
    const baseVersion = versionsRef.current[idx] ?? {};
    startSaving();
    updateSceneMutation.mutate(
      {
        sceneId,
        projectId: projectId!,
        activeVersion: activeVersionLocal,
        lockedVersion: nextLocked ?? undefined,
        newVersion: false,
        versions: [baseVersion],
      },
      { onSettled: (_, error) => endSaving(!error) }
    );
  };

  return (
    <Card
      sx={
        fullWidthInParent
          ? {
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              height: 'auto',
              display: 'flex',
              flexDirection: 'column',
              flex: '0 0 auto',
              backgroundColor: theme.palette.background.paper,
              boxShadow: '0px 8px 15px rgba(0, 0, 0, 0.1)',
              borderRadius: 2,
              border: '1px solid rgba(0, 0, 0, 0.1)',
              mb: 1.25,
            }
          : {
              ...sceneCardStyle.card,
              flex: '1 1 auto',
              minWidth: 'calc((400px - 32px) / 3)',
              '@container (min-width: 400px)': {
                flex: '1 1 calc(33.33% - 10.67px)',
                minWidth: 'calc((100% - 32px) / 3)',
                maxWidth: 'calc((100% - 32px) / 4)',
              },
              backgroundColor: theme.palette.background.paper,
              display: 'flex',
              flexDirection: 'column',
            }
      }
    >
      {/* Header: Scene title + badges — match screenplay / treatment toolbar surface */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: sideBySideCompact ? 0.5 : 1,
          px: sideBySideCompact ? 1 : 2,
          py: sideBySideCompact ? 0.75 : 1.5,
          bgcolor: 'background.default',
          borderBottom: `1px solid ${theme.palette.divider}`,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minWidth: fullWidthInParent ? 0 : 220,
            flex: 1,
          }}
        >
          {isLocked ? (
            <Typography
              variant={sideBySideCompact ? 'subtitle2' : 'subtitle1'}
              fontWeight={700}
              component="span"
              sx={multiLineTruncate(sideBySideCompact ? 2 : 4)}
            >
              {sceneContent.sceneHeading?.trim() || 'Untitled scene'}
            </Typography>
          ) : (
            <TextField
              size="small"
              value={sceneContent.sceneHeading ?? ''}
              onChange={handleContentChange('sceneHeading')}
              placeholder="Scene heading"
              variant="outlined"
              sx={{
                minWidth: fullWidthInParent ? 0 : 200,
                flex: 1,
                '& .MuiInputBase-input': { py: 0.5 },
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: sideBySideCompact ? 0.5 : 1 }}>
          <Chip
            label={`#${number}`}
            size="small"
            sx={{
              backgroundColor: theme.palette.grey[600],
              color: theme.palette.common.white,
              fontWeight: 600,
            }}
          />
          <IconButton
          size="small"
          onClick={handleToggleLock}
          sx={{
            backgroundColor: isLocked
              ? theme.palette.primary.main
              : theme.palette.grey[200],
            color: isLocked
              ? theme.palette.primary.contrastText ?? theme.palette.common.white
              : theme.palette.grey[700],
            '&:hover': {
              backgroundColor: isLocked
                ? theme.palette.primary.dark
                : theme.palette.grey[300],
            },
          }}
          aria-label={isLocked ? 'Unlock scene' : 'Lock scene'}
        >
          {isLocked ? (
            <LockIcon fontSize="small" />
          ) : (
            <LockOpenIcon fontSize="small" />
          )}
        </IconButton>
        </Box>
      </Box>
      {/* Content: Thesis, Antithesis, Synthesis (constrained height) */}
      <CardContent
        sx={{
          flex: '0 1 auto',
          height: sideBySideCompact ? 108 : 175,
          overflowY: 'auto',
          p: sideBySideCompact ? 0.75 : 1,
          px: sideBySideCompact ? 1 : 2,
          '&:last-child': { pb: sideBySideCompact ? 0.75 : 1.5 },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: sideBySideCompact ? 0.5 : 1 }}>
          <Box>
            <Typography component="span" fontWeight={700} sx={{ display: 'block', mb: 0.25 }} variant="body2">
              Thesis:
            </Typography>
            {isLocked ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sceneContent.thesis?.trim() || '—'}
              </Typography>
            ) : (
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={sideBySideCompact ? 1 : 2}
                maxRows={sideBySideCompact ? 2 : 4}
                value={sceneContent.thesis ?? ''}
                onChange={handleContentChange('thesis')}
                placeholder="—"
                variant="outlined"
                sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
              />
            )}
          </Box>
          <Box>
            <Typography component="span" fontWeight={700} sx={{ display: 'block', mb: 0.25 }} variant="body2">
              Antithesis:
            </Typography>
            {isLocked ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sceneContent.antithesis?.trim() || '—'}
              </Typography>
            ) : (
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={sideBySideCompact ? 1 : 2}
                maxRows={sideBySideCompact ? 2 : 4}
                value={sceneContent.antithesis ?? ''}
                onChange={handleContentChange('antithesis')}
                placeholder="—"
                variant="outlined"
                sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
              />
            )}
          </Box>
          <Box>
            <Typography component="span" fontWeight={700} sx={{ display: 'block', mb: 0.25 }} variant="body2">
              Synthesis:
            </Typography>
            {isLocked ? (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {sceneContent.synthesis?.trim() || '—'}
              </Typography>
            ) : (
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={sideBySideCompact ? 1 : 2}
                maxRows={sideBySideCompact ? 2 : 4}
                value={sceneContent.synthesis ?? ''}
                onChange={handleContentChange('synthesis')}
                placeholder="—"
                variant="outlined"
                sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
              />
            )}
          </Box>
        </Box>
      </CardContent>
      <Divider />
      {/* Footer: Lock, Version dropdown, Delete (taller so not cut off) */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          minHeight: sideBySideCompact ? 0 : 30,
          px: sideBySideCompact ? 1 : 2,
          py: sideBySideCompact ? 0.75 : 1.5,
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: 1,
            justifyContent: 'center',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <VersionSelectorWithAdd
            value={selectValue}
            versionOptions={versionOptionsList}
            newVersionLabel={creatingNewVersion ? versionOptionsList.length : undefined}
            onVersionChange={handleVersionSelect}
            onAddVersion={handleAddVersionClick}
            disabled={isLocked}
            addVersionAriaLabel="Add new scene version"
          />
          
          {steps.length > 0 && (
            <FormControl
              size="small"
              sx={{
                minWidth: fullWidthInParent ? 0 : 160,
                maxWidth: fullWidthInParent ? '100%' : 'none',
                flex: fullWidthInParent
                  ? sideBySideCompact
                    ? '1 1 72px'
                    : '1 1 120px'
                  : 'none',
              }}
            >
              <Select
                value={sceneContent.step ?? ''}
                onChange={handleStepChange}
                disabled={isLocked}
                displayEmpty
                sx={{
                  backgroundColor: theme.palette.grey[100],
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  '& .MuiSelect-select': { py: 0.75 },
                }}
                renderValue={(v) => v || 'Assign to Step'}
              >
                <MenuItem value="">
                  <em>Assign to Step</em>
                </MenuItem>
                {steps.map((stepOption) => (
                  <MenuItem key={`${stepOption.act}-${stepOption.name}`} value={stepOption.name}>
                    {stepOption.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
         
        </Box>
        <IconButton
          size="small"
          onClick={() => {
            if (!projectId) return;
            deleteSceneMutation.mutate(
              { sceneId, projectId },
              { onSuccess: () => onDelete?.() }
            );
          }}
          sx={{
            backgroundColor: theme.palette.error.light,
            color: theme.palette.error.contrastText ?? theme.palette.common.white,
            '&:hover': {
              backgroundColor: theme.palette.error.main,
            },
          }}
          aria-label="Delete scene"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Card>
  );
});
