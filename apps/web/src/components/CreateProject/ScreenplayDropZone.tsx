'use client'

import * as React from 'react'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { parseScreenplayPdf } from '@/lib/parseScreenplayPdf'

type DropZoneState =
  | { status: 'idle' }
  | { status: 'dragover' }
  | { status: 'parsing'; fileName: string }
  | { status: 'success'; fileName: string; pageCount: number }
  | { status: 'error'; message: string }

interface ScreenplayDropZoneProps {
  onParsed: (doc: Record<string, unknown>, pageCount: number, title: string | null) => void
  onCleared: () => void
}

export function ScreenplayDropZone({ onParsed, onCleared }: ScreenplayDropZoneProps) {
  const theme = useTheme()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dragCounterRef = React.useRef(0)
  const [state, setState] = React.useState<DropZoneState>({ status: 'idle' })

  const handleFile = React.useCallback(
    async (file: File) => {
      setState({ status: 'parsing', fileName: file.name })
      try {
        const { doc, pageCount, title } = await parseScreenplayPdf(file)
        setState({ status: 'success', fileName: file.name, pageCount })
        onParsed(doc, pageCount, title)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to parse PDF.'
        setState({ status: 'error', message })
      }
    },
    [onParsed],
  )

  const handleClear = React.useCallback(() => {
    setState({ status: 'idle' })
    onCleared()
    // Stipulation: reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [onCleared])

  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) {
      setState((prev) =>
        prev.status === 'idle' ? { status: 'dragover' } : prev,
      )
    }
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setState((prev) =>
        prev.status === 'dragover' ? { status: 'idle' } : prev,
      )
    }
  }, [])

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0

      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Stipulation: reset so re-selecting the same file works
      e.target.value = ''
      if (file) handleFile(file)
    },
    [handleFile],
  )

  if (state.status === 'success') {
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
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            title={state.fileName}
          >
            {state.fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {state.pageCount} page{state.pageCount !== 1 ? 's' : ''} parsed
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClear} aria-label="Remove imported screenplay">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    )
  }

  if (state.status === 'parsing') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          px: 2,
          py: 3,
          borderRadius: 1,
          border: `2px dashed ${theme.palette.divider}`,
        }}
      >
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Parsing {state.fileName}...
        </Typography>
      </Box>
    )
  }

  if (state.status === 'error') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 2,
          borderRadius: 1,
          border: `1px solid ${theme.palette.error.main}`,
          backgroundColor:
            theme.palette.mode === 'dark'
              ? 'rgba(211, 47, 47, 0.08)'
              : 'rgba(211, 47, 47, 0.04)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: 20 }} />
          <Typography variant="body2" color="error.main">
            {state.message}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="text"
          onClick={handleClear}
        >
          Try again
        </Button>
      </Box>
    )
  }

  const isDragover = state.status === 'dragover'

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
        cursor: 'pointer',
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={handleInputChange}
      />
      <UploadFileIcon
        sx={{
          fontSize: 32,
          color: isDragover ? 'primary.main' : 'text.disabled',
        }}
      />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Drag & drop a screenplay PDF here
      </Typography>
      <Button
        size="small"
        variant="outlined"
        component="span"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation()
          fileInputRef.current?.click()
        }}
      >
        Choose File
      </Button>
      <Typography variant="caption" color="text.disabled">
        Standard screenplay format &middot; PDF only &middot; 20MB max
      </Typography>
    </Box>
  )
}
