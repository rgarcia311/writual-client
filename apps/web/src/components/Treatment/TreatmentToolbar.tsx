'use client';

import * as React from 'react';
import type { Editor } from '@tiptap/core';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Divider,
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import TitleIcon from '@mui/icons-material/Title';

interface TreatmentToolbarProps {
  editor: Editor | null;
}

/** Toolbar for Tiptap editor: bold, italic, strike, headings, lists, blockquote, code */
export function TreatmentToolbar({ editor }: TreatmentToolbarProps) {
  if (!editor) return null;

  const ToolbarButton = ({
    active,
    onClick,
    title,
    children,
    value,
  }: {
    active: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    value: string;
  }) => (
    <Tooltip title={title}>
      <ToggleButton
        size="small"
        value={value}
        selected={active}
        onChange={() => onClick()}
        sx={{ minWidth: 36, py: 0.75 }}
        aria-label={title}
      >
        {children}
      </ToggleButton>
    </Tooltip>
  );

  return (
    <Box
      sx={{
        //position: 'sticky',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.5,
        px: 2,
        py: 1,
        m: 1,
        borderRadius: '15px',
        boxShadow: 2,
        bgcolor: 'background.default',
      }}
    >
      <ToggleButtonGroup size="small" sx={{ flexWrap: 'wrap' }}>
        <ToolbarButton
          value="bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <FormatBoldIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          value="italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <FormatItalicIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          value="strike"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <FormatStrikethroughIcon fontSize="small" />
        </ToolbarButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToggleButtonGroup size="small">
        <ToolbarButton
          value="h1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          title="Heading 1"
        >
          <TitleIcon fontSize="small" sx={{ fontSize: '1rem' }} />
        </ToolbarButton>
        <ToolbarButton
          value="h2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading 2"
        >
          <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
            H2
          </Box>
        </ToolbarButton>
        <ToolbarButton
          value="h3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Heading 3"
        >
          <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
            H3
          </Box>
        </ToolbarButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ToggleButtonGroup size="small">
        <ToolbarButton
          value="bulletList"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <FormatListBulletedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          value="orderedList"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <FormatListNumberedIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          value="blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <FormatQuoteIcon fontSize="small" />
        </ToolbarButton>
        <ToolbarButton
          value="code"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          <CodeIcon fontSize="small" />
        </ToolbarButton>
      </ToggleButtonGroup>
    </Box>
  );
}
