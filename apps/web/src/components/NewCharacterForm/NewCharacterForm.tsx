'use client';

import * as React from 'react';
import {
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  useTheme,
} from '@mui/material';

import { isValidImageUrl, getImageUrlForStorage } from '../../utils/imageUrl';
import { ImageUploadField } from '../shared/ImageUploadField';

export interface NewCharacterValues {
  name: string;
  gender: string;
  age: number | '';
  bio: string;
  want: string;
  need: string;
  imageUrl: string;
}

const BLANK_VALUES: NewCharacterValues = {
  name: '',
  gender: '',
  age: '',
  bio: '',
  want: '',
  need: '',
  imageUrl: '',
};

interface NewCharacterFormProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: NewCharacterValues) => void;
  submitting?: boolean;
  /** When provided, the form opens pre-filled with these values for editing an existing character. */
  initialValues?: NewCharacterValues;
}

export function NewCharacterForm({ open, onCancel, onSubmit, submitting = false, initialValues }: NewCharacterFormProps) {
  const theme = useTheme();
  const isEdit = Boolean(initialValues);
  const [values, setValues] = React.useState<NewCharacterValues>(initialValues ?? BLANK_VALUES);

  React.useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? BLANK_VALUES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (key: keyof NewCharacterValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = key === 'age' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
    setValues((prev) => ({ ...prev, [key]: v as any }));
  };

  const handleSubmit = () => {
    onSubmit({
      ...values,
      imageUrl: getImageUrlForStorage(values.imageUrl),
    });
  };

  const imageUrlValid = isValidImageUrl(values.imageUrl);
  const imageUrlTouched = values.imageUrl.trim().length > 0;
  const nameValid = values.name.trim().length > 0;
  const canSubmit = nameValid && !submitting && (!imageUrlTouched || imageUrlValid);

  const inputAutofillSx = {
    '& input:-webkit-autofill, & input:-webkit-autofill:focus': {
      WebkitBoxShadow: '0 0 0 100px #e0e0e0 inset',
    },
  };

  return (
    <Dialog
      fullWidth
      open={open}
      onClose={onCancel}
      PaperProps={{ style: { backgroundColor: theme.palette.background.default } }}
    >
      <DialogTitle sx={{ paddingLeft: 4, paddingTop: 3 }}>{isEdit ? 'EDIT CHARACTER' : 'CREATE CHARACTER'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4, overflow: 'visible', '& .MuiTextField-root': inputAutofillSx }}>
        <TextField
          label="Name"
          value={values.name}
          onChange={update('name')}
          fullWidth
          required
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'aria-required': true }}
        />
        <Container disableGutters sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Gender" value={values.gender} onChange={update('gender')} fullWidth InputLabelProps={{ shrink: true }} />
          <TextField label="Age" type="number" value={values.age} onChange={update('age')} fullWidth InputLabelProps={{ shrink: true }} />
        </Container>
        <ImageUploadField
          label="Image"
          value={values.imageUrl}
          onChange={(imageUrl) => setValues((prev) => ({ ...prev, imageUrl }))}
          shrinkLabel
          helperText="Paste an image URL, or upload one from your computer."
        />
        <TextField label="Bio" value={values.bio} onChange={update('bio')} fullWidth multiline minRows={3} InputLabelProps={{ shrink: true }} />
        <TextField label="Want" value={values.want} onChange={update('want')} fullWidth InputLabelProps={{ shrink: true }} />
        <TextField label="Need" value={values.need} onChange={update('need')} fullWidth InputLabelProps={{ shrink: true }} />
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 4 }}>
        <Button onClick={onCancel} variant="contained" color="secondary" disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary" disabled={!canSubmit}>
          {isEdit ? 'Save' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

