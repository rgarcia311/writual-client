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
import AddIcon from '@mui/icons-material/Add';
import { useProjectSceneMutations } from 'hooks';
import { useOutlineSaveStatusStore } from '@/state/outlineSaveStatus';

const SAVE_DEBOUNCE_MS = 2000;

interface StepOption {
  name: string;
  number: number;
  act: string;
}

interface SceneCardProps {
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
}

export const SceneCard: React.FC<SceneCardProps> = ({
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
}) => {
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
          _id: projectId!,
          number,
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
        _id: projectId,
        number,
        activeVersion: versionToSave,
        lockedVersion: lockedVersion ?? undefined,
        newVersion: false,
        versions: [updatedVersion],
      },
      { onSettled: (_, error) => endSaving(!error) }
    );
  };

  const handleVersionChange = (event: SelectChangeEvent<string>) => {
    if (isLocked) return;
    const next = parseInt(event.target.value, 10);
    if (!Number.isFinite(next) || next < 1) return;
    setCreatingNewVersion(false);
    setActiveVersionLocal(next);

    // Persist activeVersion switch (no debounce).
    if (projectId) {
      startSaving();
      const idx = Math.max(0, next - 1);
      const baseVersion = versionsRef.current[idx] ?? {};
      updateSceneMutation.mutate(
        {
          _id: projectId,
          number,
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
        _id: projectId,
        number,
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
        _id: projectId,
        number,
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
      sx={{
        ...sceneCardStyle.card,
        flex: "1 1 auto",
        minWidth: "calc((400px - 32px) / 3)",
        '@container (min-width: 400px)': {
          flex: "1 1 calc(33.33% - 10.67px)",
          minWidth: "calc((100% - 32px) / 3)",
          maxWidth: "calc((100% - 32px) / 4)",
        },
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header: Scene title + badges */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          py: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 220, flex: 1 }}>
       
          {isLocked ? (
            <Typography variant="subtitle1" fontWeight={700} component="span" sx={multiLineTruncate(4)}>
              {sceneContent.sceneHeading?.trim() || 'Untitled scene'}
            </Typography>
          ) : (
            <TextField
              size="small"
              value={sceneContent.sceneHeading ?? ''}
              onChange={handleContentChange('sceneHeading')}
              placeholder="Scene heading"
              variant="outlined"
              sx={{ minWidth: 200, flex: 1, '& .MuiInputBase-input': { py: 0.5 } }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
      <Divider />
      {/* Content: Thesis, Antithesis, Synthesis (constrained height) */}
      <CardContent
        sx={{
         
          flex: '0 1 auto',
          height: 175,
          overflowY: 'auto',
          p: 1,
          px: 2,
          '&:last-child': { pb: 1.5 },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1}}>
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
                minRows={2}
                maxRows={4}
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
                minRows={2}
                maxRows={4}
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
                minRows={2}
                maxRows={4}
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
          minHeight: 30,
          px: 2,
          py: 1.5,
          flexShrink: 0,
        }}
      >
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 140, display: 'flex', flexDirection: 'row', gap: 1, }}>
            <Select
              value={selectValue}
              onChange={handleVersionChange}
              disabled={isLocked}
              displayEmpty
              sx={{
                width: 65,
                backgroundColor: theme.palette.grey[100],
                borderRadius: 1,
                fontSize: '0.875rem',
                '& .MuiSelect-select': { py: 0.75 },
              }}
              renderValue={(v) => `v${v}`}
            >
              {versionOptionsList.map((ver) => (
                <MenuItem key={ver} value={String(ver)}>
                  v{ver}{creatingNewVersion && ver === versionOptionsList.length ? ' (New)' : ''}
                </MenuItem>
              ))}
            </Select>

            <IconButton
            size="small"
            onClick={handleAddVersionClick}
            disabled={isLocked}
            aria-label="Add new version"
            sx={{
              //ml: '20px',
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.primary.contrastText ?? theme.palette.common.white,
              '&:hover': { backgroundColor: theme.palette.primary.main },
            }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
            
          </FormControl>
          
          {steps.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
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
              { _id: projectId!, number },
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
};
