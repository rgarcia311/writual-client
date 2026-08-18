'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import type { WritingTracker } from '@/interfaces/project';
import { WritingTrackerSection, WritingTrackerFormState } from '../CreateProject/WritingTrackerSection';

export interface SerializedTracker {
  enabled: true;
  targetPageCount: number | null;
  currentPageCount: number | null;
  trackingStartDate: string;
  draftDueDates: Array<{
    draftNumber: number;
    label: string;
    dueDate: string;
    tag: string | null;
  }>;
}

interface ProgressTrackingModalProps {
  open: boolean;
  onClose: () => void;
  projectTitle: string;
  projectType?: string;
  /** Page total of the project's existing screenplay; prefills Current Page Count. */
  screenplayPageCount?: number | null;
  /**
   * Existing tracker to edit. When present, the modal is framed around editing draft deadlines or
   * adding another rather than switching tracking on, and the saved values are prefilled.
   */
  tracker?: WritingTracker | null;
  onSubmit: (tracker: SerializedTracker) => void;
  isPending?: boolean;
}

const DEFAULT_TRACKER: WritingTrackerFormState = {
  enabled: true,
  targetPageCount: '',
  currentPageCount: '',
  draftDueDates: [{ id: '1', label: 'First Draft', dueDate: '', tag: '' }],
};

/** Positive, finite page totals only — 0/null means "no screenplay pages to prefill". */
function prefillablePageCount(pageCount: number | null | undefined): number | null {
  if (pageCount == null || !Number.isFinite(pageCount)) return null;
  const rounded = Math.round(pageCount);
  return rounded > 0 ? rounded : null;
}

function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Saved tracker → editable form rows, in due-date order. */
function trackerToFormState(
  tracker: WritingTracker,
  fallbackCurrentPages: number | null,
): WritingTrackerFormState {
  const rows = (tracker.draftDueDates ?? [])
    .slice()
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .map((d, i) => ({
      id: `${d.draftNumber ?? i + 1}-${i}`,
      label: d.label ?? '',
      dueDate: d.dueDate ?? '',
      tag: d.tag ?? '',
    }));

  const currentPages = tracker.currentPageCount ?? fallbackCurrentPages;

  return {
    enabled: true,
    targetPageCount: tracker.targetPageCount != null ? String(tracker.targetPageCount) : '',
    currentPageCount: currentPages != null ? String(currentPages) : '',
    draftDueDates: rows.length > 0 ? rows : DEFAULT_TRACKER.draftDueDates,
  };
}

export function ProgressTrackingModal({
  open,
  onClose,
  projectTitle,
  projectType,
  screenplayPageCount,
  tracker = null,
  onSubmit,
  isPending = false,
}: ProgressTrackingModalProps) {
  const theme = useTheme();
  const existingPages = prefillablePageCount(screenplayPageCount);
  const isEditing = Boolean(tracker?.enabled);

  const initialForm = React.useMemo<WritingTrackerFormState>(
    () =>
      tracker?.enabled
        ? trackerToFormState(tracker, existingPages)
        : {
            ...DEFAULT_TRACKER,
            currentPageCount: existingPages != null ? String(existingPages) : '',
          },
    [tracker, existingPages],
  );

  const [form, setForm] = React.useState<WritingTrackerFormState>(initialForm);

  // Reset on open as well as on close: callers mount one modal per project, and the saved tracker or
  // screenplay page total can arrive from its query after first render.
  React.useEffect(() => {
    setForm(initialForm);
  }, [open, initialForm]);

  const hasEmptyDueDate = form.draftDueDates.some((d) => !d.dueDate);
  const isSubmitDisabled = isPending || hasEmptyDueDate;

  const handleSubmit = () => {
    const serialized: SerializedTracker = {
      enabled: true,
      targetPageCount: form.targetPageCount ? Number(form.targetPageCount) : null,
      currentPageCount: form.currentPageCount ? Number(form.currentPageCount) : null,
      // Keep the original start date when editing — resetting it would restate pace and schedule.
      trackingStartDate: tracker?.trackingStartDate ?? localDateString(),
      draftDueDates: form.draftDueDates
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((d, i) => ({
          draftNumber: i + 1,
          label: d.label,
          dueDate: d.dueDate,
          tag: d.tag || null,
        })),
    };
    onSubmit(serialized);
  };

  return (
    <Dialog
      fullWidth
      open={open}
      onClose={isPending ? undefined : onClose}
      PaperProps={{ style: { backgroundColor: theme.palette.background.default } }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        {isEditing ? 'Add Deadline' : 'Add Progress Tracking'}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {isEditing ? `${projectTitle} — edit a draft deadline or add another` : projectTitle}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <WritingTrackerSection
          value={form}
          onChange={setForm}
          projectType={projectType}
          currentPageCountHelperText={
            existingPages != null
              ? `From this project's screenplay (${existingPages} page${existingPages === 1 ? '' : 's'})`
              : undefined
          }
          hideToggle
        />
      </DialogContent>
      <DialogActions sx={{ pb: 2.5, px: 3 }}>
        <Button
          onClick={onClose}
          variant="contained"
          color="secondary"
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={isSubmitDisabled}
        >
          {isPending ? 'Saving…' : isEditing ? 'Save Deadlines' : 'Start Tracking'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
