'use client';

import * as React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import { isValidImageUrl } from '../../../utils/imageUrl';
import {
  dataUrlByteSize,
  formatBytes,
  imageFileToStorableDataUrl,
  MAX_IMAGE_DIMENSION,
} from '../../../utils/imageFile';

export interface ImageUploadFieldProps {
  label: string;
  /** Either a hosted image URL or a `data:image/…;base64,…` value. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Shown under the field while the value is valid. */
  helperText?: React.ReactNode;
  disabled?: boolean;
  /** Longest edge the uploaded image is scaled down to before it is encoded. */
  maxDimension?: number;
  /** Keep the label floated, matching forms whose other fields do the same. */
  shrinkLabel?: boolean;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

function isDataUrl(value: string): boolean {
  return value.trim().startsWith('data:');
}

/**
 * Image field for the project poster and the character/stat cards: paste a URL, or pick a file off
 * disk and store it inline as base64 (see `utils/imageFile.ts`).
 *
 * An uploaded value is a multi-hundred-kilobyte string, so it is never put in the text input — a
 * thumbnail and its stored size stand in for it, and the input comes back when the image is removed.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder = 'https://example.com/image.jpg',
  helperText,
  disabled = false,
  maxDimension = MAX_IMAGE_DIMENSION,
  shrinkLabel = false,
}: ImageUploadFieldProps) {
  const theme = useTheme();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');
  const [dragover, setDragover] = React.useState(false);

  const handleFile = React.useCallback(
    async (file: File) => {
      setUploadError('');
      setUploading(true);
      try {
        onChange(await imageFileToStorableDataUrl(file, maxDimension));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Could not read that image.');
      } finally {
        setUploading(false);
      }
    },
    [maxDimension, onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setUploadError('');
    onChange('');
  };

  const fileInput = (
    <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={handleInputChange} />
  );

  if (isDataUrl(value)) {
    return (
      <Box>
        {fileInput}
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Box
            component="img"
            src={value}
            alt={`${label} preview`}
            sx={{
              width: 48,
              height: 48,
              objectFit: 'cover',
              borderRadius: 1,
              backgroundColor: theme.palette.action.hover,
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              Uploaded image
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              Stored inline · {formatBytes(dataUrlByteSize(value))}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </Button>
          <IconButton
            size="small"
            aria-label={`Remove ${label.toLowerCase()}`}
            disabled={disabled || uploading}
            onClick={handleRemove}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {uploadError && (
          <Typography variant="caption" color="error" component="div" sx={{ mt: 0.5, ml: 1.75 }}>
            {uploadError}
          </Typography>
        )}
      </Box>
    );
  }

  const urlInvalid = Boolean(value.trim()) && !isValidImageUrl(value);
  const errorText = uploadError || (urlInvalid ? "That isn't a valid image URL." : '');

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragover(true);
      }}
      onDragLeave={() => setDragover(false)}
      onDrop={handleDrop}
      sx={{
        borderRadius: 1,
        outline: dragover ? `2px dashed ${theme.palette.primary.main}` : 'none',
        outlineOffset: 2,
      }}
    >
      {fileInput}
      <TextField
        label={label}
        value={value}
        onChange={(e) => {
          setUploadError('');
          onChange(e.target.value);
        }}
        placeholder={dragover ? 'Drop an image to upload' : placeholder}
        fullWidth
        disabled={disabled || uploading}
        error={Boolean(errorText)}
        helperText={errorText || helperText}
        InputLabelProps={shrinkLabel ? { shrink: true } : undefined}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              {uploading ? (
                <CircularProgress size={20} />
              ) : (
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={`Upload ${label.toLowerCase()} from your computer`}
                  title="Upload from your computer"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadIcon fontSize="small" />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
}
