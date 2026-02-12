'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  useTheme,
} from '@mui/material';
import { useOutlineFrameworksStore } from '@/state/outlineFrameworks';
import { ProjectType } from '@/enums/ProjectEnums';
import { CreateProjectProps } from '@/interfaces/project';

import { isValidImageUrl, getImageUrlForStorage } from '../../utils/imageUrl';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export const CreateProject: React.FC<CreateProjectProps> = ({
  setAddProject,
  handleAddProject,
  initialData,
  handleUpdateProject,
}) => {
  const frameworks = useOutlineFrameworksStore((state) => state.frameworks);
  const theme = useTheme();
  const isUpdate = Boolean(initialData && handleUpdateProject);
  const [formValues, setFormValues] = React.useState<Record<string, any>>({});
  const [sharedWithEmails, setSharedWithEmails] = React.useState<string[]>([]);
  const [emailInput, setEmailInput] = React.useState('');
  const [emailError, setEmailError] = React.useState('');

  React.useEffect(() => {
    if (!initialData) return;
    setFormValues({
      title: initialData.title ?? '',
      genre: initialData.genre ?? '',
      logline: initialData.logline ?? '',
      poster: initialData.poster ?? '',
      type: initialData.type ?? '',
      outlineName: initialData.outlineName ?? '',
      budget: initialData.budget != null && initialData.budget !== '' ? String(initialData.budget) : '',
      similarProjects: Array.isArray(initialData.similarProjects)
        ? (initialData.similarProjects as string[]).join(', ')
        : typeof initialData.similarProjects === 'string' ? initialData.similarProjects : '',
      timePeriod: initialData.timePeriod ?? '',
    });
    setSharedWithEmails(Array.isArray(initialData.sharedWith) ? (initialData.sharedWith as string[]) : []);
  }, [initialData]);

  const updateForm = React.useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { value: unknown },
    key: string
  ) => {
    const value = 'target' in e && e.target != null
      ? (e as React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>).target.value
      : (e as { value: unknown }).value;
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addEmail = React.useCallback(() => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (sharedWithEmails.includes(trimmed)) return;
    setEmailError('');
    setEmailInput('');
    setSharedWithEmails((prev) => [...prev, trimmed]);
  }, [emailInput, sharedWithEmails]);

  const removeEmail = React.useCallback((email: string) => {
    setSharedWithEmails((prev) => prev.filter((e) => e !== email));
  }, []);

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail();
    }
  };

  console.log('formValues: ', formValues);
  console.log('sharedWithEmails: ', sharedWithEmails);
  console.log('frameworks: ', frameworks);

  return (
    <Dialog
      fullWidth
      open
      onClose={() => setAddProject(false)}
      PaperProps={{ style: { backgroundColor: theme.palette.background.default } }}
    >
      <DialogTitle sx={{ paddingLeft: 4, paddingTop: 3 }}>
        {isUpdate ? 'Update Project' : 'CREATE PROJECT'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
        <TextField
          required
          label="Title"
          value={formValues.title ?? ''}
          onChange={(e) => updateForm(e, 'title')}
          placeholder="Title"
          sx={{ marginTop: '10px' }}
          fullWidth
        />
        <Container disableGutters sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Genre"
            value={formValues.genre ?? ''}
            onChange={(e) => updateForm(e, 'genre')}
            placeholder="Ex: Drama, Comedy, etc"
            fullWidth
          />
          <TextField
            label="Budget"
            value={formValues.budget ?? ''}
            onChange={(e) => updateForm(e, 'budget')}
            placeholder="Budget"
            fullWidth
          />
        </Container>
        <TextField
          label="Logline"
          value={formValues.logline ?? ''}
          onChange={(e) => updateForm(e, 'logline')}
          placeholder="Logline"
          fullWidth
        />
        <TextField
          label="Poster (Image URL)"
          value={formValues.poster ?? ''}
          onChange={(e) => updateForm(e, 'poster')}
          placeholder="https://example.com/poster.jpg"
          fullWidth
          error={Boolean(formValues.poster?.trim()) && !isValidImageUrl(formValues.poster ?? '')}
          helperText={
            formValues.poster?.trim() && !isValidImageUrl(formValues.poster ?? '')
              ? "URL isn't a valid image URL."
              : undefined
          }
        />
        <Box>
          <TextField
            label="Share with (email)"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setEmailError(''); }}
            onBlur={addEmail}
            onKeyDown={handleEmailKeyDown}
            placeholder="Enter email and press Enter"
            fullWidth
            size="small"
            error={Boolean(emailError)}
            helperText={emailError}
          />
          {sharedWithEmails.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              {sharedWithEmails.map((email) => (
                <Chip
                  key={email}
                  label={email}
                  onDelete={() => removeEmail(email)}
                  size="small"
                />
              ))}
            </Box>
          )}
        </Box>
        <Container disableGutters sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Similar projects"
            value={formValues.similarProjects ?? ''}
            onChange={(e) => updateForm(e, 'similarProjects')}
            placeholder="Similar Movies"
            fullWidth
          />
          <TextField
            label="Time Period"
            value={formValues.timePeriod ?? ''}
            onChange={(e) => updateForm(e, 'timePeriod')}
            placeholder="Time Period"
            fullWidth
          />
        </Container>
        <Container disableGutters sx={{ display: 'flex', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Project Type</InputLabel>
            <Select
              required
              value={formValues.type ?? ''}
              label="Project Type"
              onChange={(e) => updateForm(e as any, 'type')}
            >
              <MenuItem value={ProjectType.Feature}>Feature Film</MenuItem>
              <MenuItem value={ProjectType.Television}>Television</MenuItem>
              <MenuItem value={ProjectType.Short}>Short Film</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Outline</InputLabel>
            <Select
              value={formValues.outlineName ?? ''}
              label="Outline"
              onChange={(e) => updateForm(e as any, 'outlineName')}
            >
              {frameworks.length > 0 ? (
                frameworks.map((fw) => (
                  <MenuItem key={fw.id} value={fw.name}>
                    {fw.name}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="">
                  <em>Create Outline</em>
                </MenuItem>
              )}
            </Select>
          </FormControl>
        </Container>
      </DialogContent>
      <DialogActions sx={{ paddingBottom: 3, paddingRight: 4 }}>
        <Button onClick={() => setAddProject(false)} variant="contained" color="secondary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            const budgetNum = formValues.budget !== undefined && formValues.budget !== '' ? Number(formValues.budget) : undefined;
            const similarProjects = typeof formValues.similarProjects === 'string'
              ? formValues.similarProjects.split(',').map((s: string) => s.trim()).filter(Boolean)
              : Array.isArray(formValues.similarProjects) ? formValues.similarProjects : [];
            const payload = {
              ...formValues,
              title: formValues.title ?? '',
              logline: formValues.logline ?? '',
              genre: formValues.genre ?? '',
              type: formValues.type ?? '',
              poster: getImageUrlForStorage(formValues.poster ?? ''),
              sharedWith: sharedWithEmails,
              budget: budgetNum,
              similarProjects,
              outlineName: formValues.outlineName ?? undefined,
              timePeriod: formValues.timePeriod ?? undefined,
            };
            if (isUpdate && handleUpdateProject) {
              handleUpdateProject(payload);
            } else {
              handleAddProject(payload);
            }
            setAddProject(false);
          }}
          variant="contained"
          color="primary"
          disabled={
            !(formValues.title ?? '').trim() ||
            (Boolean(formValues.poster?.trim()) && !isValidImageUrl(formValues.poster ?? ''))
          }
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
};