'use client';

import * as React from 'react';
import {
  Box,
  ListSubheader,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { AssociationTarget, LinkedAssociationKind } from '@/components/NoteCard';
import {
  ALL_ASSOCIATIONS,
  ALL_CATEGORIES,
  GENERAL_ASSOCIATION,
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  type NoteSortMode,
  type NoteStatusFilter,
} from './noteFiltering';

const KIND_SECTIONS: Array<{ kind: LinkedAssociationKind; label: string }> = [
  { kind: 'character', label: 'Characters' },
  { kind: 'scene', label: 'Scenes' },
  { kind: 'inspiration', label: 'Inspiration' },
];

interface NotesFilterBarProps {
  status: NoteStatusFilter;
  onStatusChange: (status: NoteStatusFilter) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  categoryOptions: string[];
  association: string;
  onAssociationChange: (association: string) => void;
  associationTargets: AssociationTarget[];
  sort: NoteSortMode;
  onSortChange: (sort: NoteSortMode) => void;
}

export function NotesFilterBar({
  status,
  onStatusChange,
  category,
  onCategoryChange,
  categoryOptions,
  association,
  onAssociationChange,
  associationTargets,
  sort,
  onSortChange,
}: NotesFilterBarProps) {
  // Sections are rendered as a flat child list: MUI's Select reads `value` off MenuItem
  // children directly, so nesting them inside per-kind fragments would break selection.
  const associationItems = React.useMemo(() => {
    const items: React.ReactNode[] = [
      <MenuItem key={ALL_ASSOCIATIONS} value={ALL_ASSOCIATIONS}>
        All associations
      </MenuItem>,
      <MenuItem key={GENERAL_ASSOCIATION} value={GENERAL_ASSOCIATION}>
        General notes
      </MenuItem>,
    ];
    for (const section of KIND_SECTIONS) {
      const targets = associationTargets.filter((target) => target.kind === section.kind);
      if (targets.length === 0) continue;
      items.push(<ListSubheader key={`${section.kind}-header`}>{section.label}</ListSubheader>);
      for (const target of targets) {
        items.push(
          <MenuItem key={target.id} value={target.id}>
            {target.label}
          </MenuItem>
        );
      }
    }
    return items;
  }, [associationTargets]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        pb: 'var(--app-body-padding, 8px)',
        marginTop: '8px',
        bgcolor: 'background.default',
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={status}
        onChange={(_e, next: NoteStatusFilter | null) => next && onStatusChange(next)}
        aria-label="Filter notes by status"
      >
        {STATUS_FILTER_OPTIONS.map((filter) => (
          <ToggleButton key={filter.value} value={filter.value}>
            {filter.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <TextField
        select
        size="small"
        label="Associated with"
        value={association}
        onChange={(e) => onAssociationChange(e.target.value)}
        sx={{ minWidth: 220 }}
        InputLabelProps={{ shrink: true }}
      >
        {associationItems}
      </TextField>

      <TextField
        select
        size="small"
        label="Sort by"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as NoteSortMode)}
        sx={{ minWidth: 160 }}
        InputLabelProps={{ shrink: true }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      {categoryOptions.length > 0 && (
        <TextField
          select
          size="small"
          label="Category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          sx={{ minWidth: 180 }}
          InputLabelProps={{ shrink: true }}
        >
          <MenuItem value={ALL_CATEGORIES}>All categories</MenuItem>
          {categoryOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Box>
  );
}
