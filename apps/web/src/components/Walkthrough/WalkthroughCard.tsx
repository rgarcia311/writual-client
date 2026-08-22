'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import type { WalkthroughStep } from './types';

export interface WalkthroughCardProps {
  step: WalkthroughStep;
  stepNumber: number;
  stepCount: number;
  isFirst: boolean;
  isLast: boolean;
  /** True while the tour is waiting for the user to perform the step's action. */
  waiting: boolean;
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onSkipStep: () => void;
  onClose: () => void;
}

/** The tooltip body: copy, progress, and whatever controls the step allows. */
export function WalkthroughCard({
  step,
  stepNumber,
  stepCount,
  isFirst,
  isLast,
  waiting,
  dontShowAgain,
  onDontShowAgainChange,
  onBack,
  onNext,
  onSkipStep,
  onClose,
}: WalkthroughCardProps) {
  return (
    <Paper
      elevation={8}
      role="dialog"
      aria-modal="false"
      aria-label={`Walkthrough step ${stepNumber} of ${stepCount}: ${step.title}`}
      sx={{
        width: 'min(380px, calc(100vw - 32px))',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <LinearProgress
        variant="determinate"
        value={(stepNumber / stepCount) * 100}
        sx={{ height: 3 }}
      />

      <Box sx={{ p: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
              Step {stepNumber} of {stepCount}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              {step.title}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Close walkthrough" sx={{ mt: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {step.body.map((paragraph) => (
          <Typography key={paragraph} variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            {paragraph}
          </Typography>
        ))}

        {waiting && step.actionHint && (
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 1,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
            }}
          >
            <TouchAppIcon fontSize="small" color="primary" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {step.actionHint}
            </Typography>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          px: 2.5,
          pb: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button size="small" onClick={onBack} disabled={isFirst} sx={{ textTransform: 'none' }}>
            Back
          </Button>
          <Box sx={{ flex: 1 }} />
          {waiting ? (
            // An escape hatch: nobody should be trapped by a prompt they cannot or would rather
            // not follow, so the step can always be stepped over.
            <Button size="small" onClick={onSkipStep} sx={{ textTransform: 'none' }}>
              Skip this step
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={onNext} sx={{ textTransform: 'none' }}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          )}
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={dontShowAgain}
              onChange={(event) => onDontShowAgainChange(event.target.checked)}
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              Don&apos;t show this again
            </Typography>
          }
          sx={{ ml: -0.5, mr: 0 }}
        />
      </Box>
    </Paper>
  );
}
