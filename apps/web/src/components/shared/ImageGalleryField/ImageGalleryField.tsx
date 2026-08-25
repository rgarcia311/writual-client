'use client';

import * as React from 'react';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ImageUploadField } from '../ImageUploadField';

/**
 * Uploaded images are stored inline as base64 (up to 2MB each, see `utils/imageFile.ts`) on the
 * same document, so the gallery is capped well short of MongoDB's 16MB document limit.
 */
export const MAX_GALLERY_IMAGES = 6;

export interface ImageGalleryFieldProps {
  label: string;
  /** Image URLs / data URLs in display order; the first is the primary image. */
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  helperText?: React.ReactNode;
  maxImages?: number;
}

/**
 * Ordered list of image fields for surfaces that show more than one picture — the character card
 * scrolls through them in this order, with the first entry acting as the primary portrait.
 *
 * Blank rows are kept while the dialog is open (a row the user is still filling in) and dropped by
 * the caller on submit.
 */
export function ImageGalleryField({
  label,
  value,
  onChange,
  disabled = false,
  helperText,
  maxImages = MAX_GALLERY_IMAGES,
}: ImageGalleryFieldProps) {
  // A dialog that opens with no images still shows one empty field to type or upload into.
  const rows = value.length ? value : [''];

  const replaceAt = (index: number, next: string) =>
    onChange(rows.map((url, i) => (i === index ? next : url)));

  const removeAt = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const canAdd = rows.length < maxImages;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map((url, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ImageUploadField
              label={index === 0 ? `${label} (primary)` : `${label} ${index + 1}`}
              value={url}
              onChange={(next) => replaceAt(index, next)}
              disabled={disabled}
              shrinkLabel
              helperText={index === 0 ? helperText : undefined}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', pt: 1 }}>
            <Tooltip title="Move earlier">
              <span>
                <IconButton
                  size="small"
                  aria-label={`Move image ${index + 1} earlier`}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move later">
              <span>
                <IconButton
                  size="small"
                  aria-label={`Move image ${index + 1} later`}
                  disabled={disabled || index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Remove image">
              <span>
                <IconButton
                  size="small"
                  aria-label={`Remove image ${index + 1}`}
                  disabled={disabled || rows.length === 1}
                  onClick={() => removeAt(index)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      ))}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          startIcon={<AddPhotoAlternateIcon />}
          disabled={disabled || !canAdd}
          onClick={() => onChange([...rows, ''])}
        >
          Add image
        </Button>
        <Typography variant="caption" color="text.secondary">
          {canAdd
            ? `${rows.length} of ${maxImages} — the card scrolls through them in this order.`
            : `Maximum of ${maxImages} images.`}
        </Typography>
      </Box>
    </Box>
  );
}
