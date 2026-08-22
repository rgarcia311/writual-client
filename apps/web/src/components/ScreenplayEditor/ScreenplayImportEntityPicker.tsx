'use client'

import * as React from 'react'
import {
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  Typography,
} from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'

export interface ImportEntityOption {
  id: string
  label: string
  locked: boolean
}

interface ScreenplayImportEntityPickerProps {
  characters: ImportEntityOption[]
  scenes: ImportEntityOption[]
  selectedCharacterIds: string[]
  selectedSceneIds: string[]
  onChangeCharacters: (ids: string[]) => void
  onChangeScenes: (ids: string[]) => void
}

/**
 * Lets the writer choose which existing character and scene cards a replacing import overwrites.
 *
 * Checked cards are deleted and rebuilt from the incoming script; unchecked cards survive untouched.
 * Locked cards are shown but not selectable — locking is the writer's explicit "this is finished"
 * signal, and an import should never quietly discard one.
 */
export function ScreenplayImportEntityPicker({
  characters,
  scenes,
  selectedCharacterIds,
  selectedSceneIds,
  onChangeCharacters,
  onChangeScenes,
}: ScreenplayImportEntityPickerProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <EntitySection
        title="Characters"
        options={characters}
        selectedIds={selectedCharacterIds}
        onChange={onChangeCharacters}
        emptyLabel="No character cards yet."
      />
      <Divider />
      <EntitySection
        title="Scenes"
        options={scenes}
        selectedIds={selectedSceneIds}
        onChange={onChangeScenes}
        emptyLabel="No scene cards yet."
      />
    </Box>
  )
}

interface EntitySectionProps {
  title: string
  options: ImportEntityOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyLabel: string
}

function EntitySection({
  title,
  options,
  selectedIds,
  onChange,
  emptyLabel,
}: EntitySectionProps) {
  const selectable = React.useMemo(() => options.filter((o) => !o.locked), [options])
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const allSelected =
    selectable.length > 0 && selectable.every((o) => selectedSet.has(o.id))
  const someSelected = selectable.some((o) => selectedSet.has(o.id))

  const toggleAll = React.useCallback(() => {
    onChange(allSelected ? [] : selectable.map((o) => o.id))
  }, [allSelected, selectable, onChange])

  const toggleOne = React.useCallback(
    (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onChange(Array.from(next))
    },
    [selectedIds, onChange],
  )

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {title}
        </Typography>
        {selectable.length > 0 && (
          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onChange={toggleAll}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Select all
              </Typography>
            }
          />
        )}
      </Box>

      {options.length === 0 ? (
        <Typography variant="caption" color="text.disabled">
          {emptyLabel}
        </Typography>
      ) : (
        <List dense disablePadding sx={{ maxHeight: 180, overflowY: 'auto' }}>
          {options.map((option) => (
            <ListItem key={option.id} disableGutters sx={{ py: 0 }}>
              <FormControlLabel
                sx={{ flex: 1, minWidth: 0 }}
                control={
                  <Checkbox
                    size="small"
                    disabled={option.locked}
                    checked={selectedSet.has(option.id)}
                    onChange={() => toggleOne(option.id)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      title={option.label}
                      color={option.locked ? 'text.disabled' : 'text.primary'}
                    >
                      {option.label}
                    </Typography>
                    {option.locked && (
                      <Chip
                        icon={<LockIcon sx={{ fontSize: 12 }} />}
                        label="Locked"
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.6rem' }}
                      />
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  )
}
