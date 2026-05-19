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

interface EnableProgressTrackingModalProps {
  open: boolean;
  onClose: () => void;
  projectTitle: string;
  projectType?: string;
  onSubmit: (tracker: SerializedTracker) => void;
  isPending?: boolean;
}

const DEFAULT_TRACKER: WritingTrackerFormState = {
  enabled: true,
  targetPageCount: '',
  currentPageCount: '',
  draftDueDates: [{ id: '1', label: 'First Draft', dueDate: '', tag: '' }],
};

function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EnableProgressTrackingModal({
  open,
  onClose,
  projectTitle,
  projectType,
  onSubmit,
  isPending = false,
}: EnableProgressTrackingModalProps) {
  const theme = useTheme();
  const [tracker, setTracker] = React.useState<WritingTrackerFormState>(DEFAULT_TRACKER);

  React.useEffect(() => {
    if (!open) {
      setTracker(DEFAULT_TRACKER);
    }
  }, [open]);

  const hasEmptyDueDate = tracker.draftDueDates.some((d) => !d.dueDate);
  const isSubmitDisabled = isPending || hasEmptyDueDate;

  const handleSubmit = () => {
    const serialized: SerializedTracker = {
      enabled: true,
      targetPageCount: tracker.targetPageCount ? Number(tracker.targetPageCount) : null,
      currentPageCount: tracker.currentPageCount ? Number(tracker.currentPageCount) : null,
      trackingStartDate: localDateString(),
      draftDueDates: tracker.draftDueDates.map((d, i) => ({
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
        Add Progress Tracking
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {projectTitle}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <WritingTrackerSection
          value={tracker}
          onChange={setTracker}
          projectType={projectType}
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
          {isPending ? 'Saving…' : 'Start Tracking'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
