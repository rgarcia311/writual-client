'use client'

import * as React from 'react'
import { Box, Button, IconButton, Typography, useTheme } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

interface ScreenplayPdfDropZoneProps {
  file: File | null
  disabled?: boolean
  onFileSelected: (file: File) => void
  onCleared: () => void
}

/**
 * File-selection surface for the screenplay page's import dialog.
 *
 * Unlike the create-project drop zone this one only *chooses* the file — parsing happens when the
 * import actually runs, because the writer may still change their mind about replacing versus
 * adding, and parsing a feature script is slow enough to be worth deferring until they commit.
 */
export function ScreenplayPdfDropZone({
  file,
  disabled = false,
  onFileSelected,
  onCleared,
}: ScreenplayPdfDropZoneProps) {
  const theme = useTheme()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)
  const [isDragover, setIsDragover] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleFile = React.useCallback(
    (candidate: File) => {
      const invalid = validatePdfFile(candidate)
      if (invalid) {
        setError(invalid)
        return
      }
      setError(null)
      onFileSelected(candidate)
    },
    [onFileSelected],
  )

  const handleDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      dragCounterRef.current++
      if (dragCounterRef.current === 1) setIsDragover(true)
    },
    [disabled],
  )

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragover(false)
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragover(false)
      if (disabled) return
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFile(dropped)
    },
    [disabled, handleFile],
  )

  if (file) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: 1,
          border: `1px solid ${theme.palette.success.main}`,
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(46, 125, 50, 0.08)'
              : 'rgba(46, 125, 50, 0.04)',
        }}
      >
        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap title={file.name}>
            {file.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onCleared}
          disabled={disabled}
          aria-label="Remove selected PDF"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    )
  }

  return (
    <Box>
      <Box
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 3,
          borderRadius: 1,
          border: `2px dashed ${isDragover ? theme.palette.primary.main : theme.palette.divider}`,
          backgroundColor: isDragover
            ? theme.palette.mode === 'dark'
              ? 'rgba(144, 202, 249, 0.08)'
              : 'rgba(25, 118, 210, 0.04)'
            : 'transparent',
          transition: 'border-color 0.15s, background-color 0.15s',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={(e) => {
            const selected = e.target.files?.[0]
            e.target.value = ''
            if (selected) handleFile(selected)
          }}
        />
        <UploadFileIcon
          sx={{ fontSize: 32, color: isDragover ? 'primary.main' : 'text.disabled' }}
        />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Drag &amp; drop a screenplay PDF here
        </Typography>
        <Button
          size="small"
          variant="outlined"
          component="span"
          disabled={disabled}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
        >
          Choose File
        </Button>
        <Typography variant="caption" color="text.disabled" textAlign="center">
          Standard screenplay format · PDF only · 20MB max
        </Typography>
      </Box>

      {error && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: 18 }} />
          <Typography variant="caption" color="error.main">
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

function validatePdfFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return 'Please select a PDF file.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 20MB limit.`
  }
  return null
}
