'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

export interface OutlineStepInput {
  step_id?: string;
  name: string;
  /** Set on submit from array index + 1; not edited in the form. */
  number?: number;
  act: string;
  instructions: string;
}

export interface OutlineFrameworkFormValues {
  imageUrl: string;
  formatName: string;
  steps: OutlineStepInput[];
}

export interface OutlineFrameworkFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: OutlineFrameworkFormValues) => void;
  initialData?: {
    id: string;
    name: string;
    imageUrl?: string;
    format?: {
      name?: string;
      steps?: Array<{ step_id?: string; name?: string; number?: number; act?: string; instructions?: string }>;
    };
  } | null;
  submitLabel?: string;
  submitting?: boolean;
}

const defaultStep = (): OutlineStepInput => ({
  name: '',
  act: '',
  instructions: '',
});

export function OutlineFrameworkForm({
  open,
  onClose,
  onSubmit,
  initialData = null,
  submitLabel = 'Create framework',
  submitting = false,
}: OutlineFrameworkFormProps) {
  const theme = useTheme();
  const [imageUrl, setImageUrl] = React.useState('');
  const [formatName, setFormatName] = React.useState('');
  const [steps, setSteps] = React.useState<OutlineStepInput[]>([]);

  React.useEffect(() => {
    if (!open) return;
    if (initialData) {
      setImageUrl(initialData.imageUrl ?? '');
      setFormatName(initialData.format?.name ?? initialData.name ?? '');
      setSteps(
        (initialData.format?.steps?.length
          ? initialData.format.steps.map((s) => ({
              step_id: s.step_id,
              name: s.name ?? '',
              act: s.act ?? '',
              instructions: s.instructions ?? '',
            }))
          : [defaultStep()]) as OutlineStepInput[]
      );
    } else {
      setImageUrl('');
      setFormatName('');
      setSteps([defaultStep()]);
    }
  }, [open, initialData]);

  const handleAddStep = () => {
    setSteps((prev) => [...prev, defaultStep()]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: keyof OutlineStepInput, value: string | number) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = () => {
    const formatSteps = steps.map((s, i) => ({
      step_id: s.step_id || `step_${i}`,
      name: s.name,
      number: i + 1,
      act: s.act,
      instructions: s.instructions,
    }));
    onSubmit({
      imageUrl,
      formatName,
      steps: formatSteps,
    });
  };

  const canSubmit = formatName.trim().length > 0;

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={onClose}
      PaperProps={{ style: { backgroundColor: theme.palette.background.default } }}
    >
      <DialogTitle sx={{ px: 3, pt: 2, pb: 0.5 }}>
        {initialData ? 'Edit outline framework' : 'Create outline framework'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 3, pt: 2, minHeight: 420 }}>
        <TextField
          label="Format name"
          value={formatName}
          onChange={(e) => setFormatName(e.target.value)}
          fullWidth
          required
          InputLabelProps={{ shrink: true }}
          sx={{ mt: 1 }}
        />
        <TextField
          label="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          fullWidth
          placeholder="https://..."
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="subtitle2">Steps</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={handleAddStep}>
            Add step
          </Button>
        </Box>
        {steps.map((step, index) => (
          <Box
            key={index}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Step {index + 1}
              </Typography>
              <IconButton
                size="small"
                onClick={() => handleRemoveStep(index)}
                disabled={steps.length <= 1}
                aria-label="Remove step"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <TextField
              size="small"
              label="Name"
              value={step.name}
              onChange={(e) => handleStepChange(index, 'name', e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Act"
              value={step.act}
              onChange={(e) => handleStepChange(index, 'act', e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Instructions"
              value={step.instructions}
              onChange={(e) => handleStepChange(index, 'instructions', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="secondary" disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
