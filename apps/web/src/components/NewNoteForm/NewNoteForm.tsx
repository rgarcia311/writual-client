'use client';

import * as React from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { RichTextField } from '@/components/RichTextField';
import { DialogCloseButton } from '@/shared/DialogCloseButton';
import {
  getNoteStatus,
  noteStatusFlags,
  NOTE_STATUS_LABELS,
  NOTE_STATUS_ORDER,
  type AssociationTarget,
  type NoteAssociationKind,
} from '@/components/NoteCard';

export interface NewNoteValues {
  title: string;
  category: string;
  /** Rich text as HTML. */
  content: string;
  incorporated: boolean;
  shouldIncorporate: boolean;
  associationKind: NoteAssociationKind;
  associationTargetId: string | null;
  associationLabel: string | null;
}

export const BLANK_NOTE_VALUES: NewNoteValues = {
  title: '',
  category: '',
  content: '',
  incorporated: false,
  shouldIncorporate: true,
  associationKind: 'none',
  associationTargetId: null,
  associationLabel: null,
};

const ASSOCIATION_KIND_OPTIONS: Array<{ value: NoteAssociationKind; label: string }> = [
  { value: 'none', label: 'General note' },
  { value: 'character', label: 'Character' },
  { value: 'scene', label: 'Scene' },
  { value: 'inspiration', label: 'Inspiration' },
];

const ASSOCIATION_TARGET_LABELS: Record<NoteAssociationKind, string> = {
  none: 'Target',
  character: 'Character',
  scene: 'Scene',
  inspiration: 'Inspiration item',
};

const ASSOCIATION_EMPTY_LABELS: Record<NoteAssociationKind, string> = {
  none: 'Pick a type first',
  character: 'No characters yet',
  scene: 'No scenes yet',
  inspiration: 'No inspiration items yet',
};

interface NewNoteFormProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: NewNoteValues) => void;
  submitting?: boolean;
  /** When provided, the form opens pre-filled for editing an existing note. */
  initialValues?: NewNoteValues;
  /**
   * Overrides the heading/submit wording that `initialValues` otherwise implies — the scratch
   * pad pre-fills the form but is still creating a new note.
   */
  mode?: 'create' | 'edit';
  /** Existing categories in the project, offered as autocomplete suggestions. */
  categoryOptions?: string[];
  /** Characters, scenes and inspiration items the note can be linked to. */
  associationTargets?: AssociationTarget[];
}

export function NewNoteForm({
  open,
  onCancel,
  onSubmit,
  submitting = false,
  initialValues,
  mode,
  categoryOptions = [],
  associationTargets = [],
}: NewNoteFormProps) {
  const theme = useTheme();
  const isEdit = mode ? mode === 'edit' : Boolean(initialValues);
  const [values, setValues] = React.useState<NewNoteValues>(initialValues ?? BLANK_NOTE_VALUES);
  // Remounts the uncontrolled rich text editor when the dialog reopens with different content.
  const [editorKey, setEditorKey] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? BLANK_NOTE_VALUES);
    setEditorKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof NewNoteValues>(key: K, value: NewNoteValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const targetsForKind = React.useMemo(
    () => associationTargets.filter((t) => t.kind === values.associationKind),
    [associationTargets, values.associationKind]
  );

  const selectedTarget =
    targetsForKind.find((t) => t.id === values.associationTargetId) ?? null;

  const handleKindChange = (kind: NoteAssociationKind) => {
    // Switching kind invalidates any previously picked target.
    setValues((prev) => ({
      ...prev,
      associationKind: kind,
      associationTargetId: null,
      associationLabel: null,
    }));
  };

  // Status is stored as the `shouldIncorporate` / `incorporated` pair; the form edits it as
  // one three-way choice so the two flags can never contradict each other.
  const status = getNoteStatus(values);
  const handleStatusChange = (next: (typeof NOTE_STATUS_ORDER)[number]) =>
    setValues((prev) => ({ ...prev, ...noteStatusFlags(next) }));

  const canSubmit = values.title.trim().length > 0 && !submitting;

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={onCancel}
      PaperProps={{ style: { backgroundColor: theme.palette.background.default } }}
    >
      <DialogCloseButton onClose={onCancel} label="Close note form" />
      <DialogTitle sx={{ paddingLeft: 4, paddingTop: 3, pr: 5 }}>
        {isEdit ? 'EDIT NOTE' : 'CREATE NOTE'}
      </DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4, overflow: 'visible' }}
      >
        <Container disableGutters sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Title"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-required': true }}
          />
          <Autocomplete
            freeSolo
            options={categoryOptions}
            value={values.category}
            onChange={(_e, next) => set('category', (next as string) ?? '')}
            onInputChange={(_e, next) => set('category', next ?? '')}
            fullWidth
            renderInput={(params) => (
              <TextField
                {...params}
                label="Category"
                placeholder="Research, Dialogue, Theme…"
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />
        </Container>

        <RichTextField
          key={editorKey}
          label="Note"
          value={values.content}
          onChange={(html) => set('content', html)}
          placeholder="Write or paste formatted text…"
          disabled={submitting}
        />

        <Container disableGutters sx={{ display: 'flex', gap: 2 }}>
          <TextField
            select
            label="Associated with"
            value={values.associationKind}
            onChange={(e) => handleKindChange(e.target.value as NoteAssociationKind)}
            sx={{ minWidth: 180 }}
            InputLabelProps={{ shrink: true }}
          >
            {ASSOCIATION_KIND_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            disabled={values.associationKind === 'none'}
            options={targetsForKind}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={selectedTarget}
            onChange={(_e, next) =>
              setValues((prev) => ({
                ...prev,
                associationTargetId: next?.id ?? null,
                associationLabel: next?.label ?? null,
              }))
            }
            fullWidth
            noOptionsText={ASSOCIATION_EMPTY_LABELS[values.associationKind]}
            renderInput={(params) => (
              <TextField
                {...params}
                label={ASSOCIATION_TARGET_LABELS[values.associationKind]}
                placeholder={
                  values.associationKind === 'none'
                    ? ASSOCIATION_EMPTY_LABELS.none
                    : 'Search…'
                }
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />
        </Container>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Status
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={status}
            onChange={(_e, next) => next && handleStatusChange(next)}
            aria-label="Note status"
            sx={{ alignSelf: 'flex-start' }}
          >
            {NOTE_STATUS_ORDER.map((option) => (
              <ToggleButton key={option} value={option}>
                {NOTE_STATUS_LABELS[option]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 4 }}>
        <Button onClick={onCancel} variant="contained" color="secondary" disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(values)} variant="contained" color="primary" disabled={!canSubmit}>
          {isEdit ? 'Save' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
