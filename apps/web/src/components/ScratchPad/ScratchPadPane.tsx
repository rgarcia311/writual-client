'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { RichTextField } from '@/components/RichTextField';
import { NewNoteForm } from '@/components/NewNoteForm';
import { AppAlert } from '@/components/AppAlert';
import { FeatureGate } from '@/components/Auth/FeatureGate';
import {
  SCRATCH_PAD_MIN_HEIGHT_PX,
  SCRATCH_PAD_MIN_WIDTH_PX,
  scratchPadHasContent,
  useScratchPadStore,
} from '@/state/scratchPad';
import { useScratchPadNoteConversion } from './useScratchPadNoteConversion';

/** Above the reference panes (base 1250) so the pad a user just opened isn't buried. */
const PANE_Z_INDEX = 1350;
const RESIZE_HANDLE_PX = 16;

interface ScratchPadPaneProps {
  projectId: string;
}

export function ScratchPadPane({ projectId }: ScratchPadPaneProps) {
  const x = useScratchPadStore((s) => s.x);
  const y = useScratchPadStore((s) => s.y);
  const width = useScratchPadStore((s) => s.width);
  const height = useScratchPadStore((s) => s.height);
  const content = useScratchPadStore((s) => s.contentByProject[projectId] ?? '');
  const closePad = useScratchPadStore((s) => s.closePad);
  const setPosition = useScratchPadStore((s) => s.setPosition);
  const setSize = useScratchPadStore((s) => s.setSize);
  const setContent = useScratchPadStore((s) => s.setContent);
  const clearContent = useScratchPadStore((s) => s.clearContent);

  const conversion = useScratchPadNoteConversion({ projectId, content });

  // The editor is uncontrolled — it reads its value once on mount — so it is remounted when the
  // pad switches projects or its content is cleared out from under it.
  const [editorKey, setEditorKey] = React.useState(0);
  React.useEffect(() => {
    setEditorKey((k) => k + 1);
  }, [projectId]);

  const dragOffsetRef = React.useRef<{ dx: number; dy: number } | null>(null);
  const resizeStartRef = React.useRef<{
    pointerX: number;
    pointerY: number;
    width: number;
    height: number;
  } | null>(null);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOffsetRef.current = { dx: e.clientX - (x ?? 0), dy: e.clientY - (y ?? 0) };
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const offset = dragOffsetRef.current;
    if (!offset) return;
    setPosition(e.clientX - offset.dx, e.clientY - offset.dy);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffsetRef.current) return;
    dragOffsetRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, width, height };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStartRef.current;
    if (!start) return;
    setSize(
      start.width + (e.clientX - start.pointerX),
      start.height + (e.clientY - start.pointerY)
    );
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleClear = () => {
    clearContent(projectId);
    setEditorKey((k) => k + 1);
  };

  const hasContent = scratchPadHasContent(content);

  return (
    <>
      <Box
        role="dialog"
        aria-label="Scratch pad"
        sx={{
          position: 'fixed',
          left: x ?? 16,
          top: y ?? 96,
          width,
          height,
          minWidth: SCRATCH_PAD_MIN_WIDTH_PX,
          minHeight: SCRATCH_PAD_MIN_HEIGHT_PX,
          zIndex: PANE_Z_INDEX,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          boxShadow: 8,
          overflow: 'hidden',
        }}
      >
        <Box
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          sx={{
            flexShrink: 0,
            cursor: 'move',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Scratch Pad
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Clear scratch pad">
              <span>
                <IconButton
                  size="small"
                  aria-label="Clear scratch pad"
                  disabled={!hasContent}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleClear}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              size="small"
              aria-label="Close scratch pad"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={closePad}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 1.5 }}>
          <RichTextField
            key={`${projectId}-${editorKey}`}
            fillHeight
            value={content}
            onChange={(html) => setContent(projectId, html)}
            placeholder="Jot down anything — ideas, lines, research…"
          />
        </Box>

        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 1.5,
            py: 1,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
            Saved for this browser session only. Convert to a note to keep it.
          </Typography>
          <FeatureGate minTier="indie">
            <Button
              variant="contained"
              size="small"
              startIcon={<NoteAddIcon />}
              disabled={!hasContent}
              onClick={conversion.openForm}
              sx={{ flexShrink: 0 }}
            >
              Convert to Note
            </Button>
          </FeatureGate>
        </Box>

        <Box
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          aria-hidden="true"
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: RESIZE_HANDLE_PX,
            height: RESIZE_HANDLE_PX,
            cursor: 'nwse-resize',
            touchAction: 'none',
          }}
        />
      </Box>

      <NewNoteForm
        open={conversion.formOpen}
        onCancel={conversion.closeForm}
        onSubmit={conversion.submit}
        submitting={conversion.submitting}
        initialValues={conversion.initialValues}
      />

      <AppAlert
        open={Boolean(conversion.alert)}
        onClose={conversion.dismissAlert}
        message={conversion.alert?.message ?? ''}
        severity={conversion.alert?.severity ?? 'success'}
      />
    </>
  );
}
