'use client';

import * as React from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Box, Divider, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import TitleIcon from '@mui/icons-material/Title';
import './richTextField.css';

interface RichTextFieldProps {
  /** HTML string. Read once when the editor mounts — this is an uncontrolled input. */
  value: string;
  /** Fires on every edit with the editor's serialized HTML. */
  onChange: (html: string) => void;
  label?: string;
  placeholder?: string;
  minHeight?: number | string;
  disabled?: boolean;
}

/** Every formatting control, keyed by the StarterKit command it toggles. */
type ToolbarCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote';

const MARK_BUTTONS: Array<{ command: ToolbarCommand; label: string; Icon: typeof FormatBoldIcon }> = [
  { command: 'bold', label: 'Bold', Icon: FormatBoldIcon },
  { command: 'italic', label: 'Italic', Icon: FormatItalicIcon },
  { command: 'underline', label: 'Underline', Icon: FormatUnderlinedIcon },
  { command: 'strike', label: 'Strikethrough', Icon: StrikethroughSIcon },
];

const BLOCK_BUTTONS: Array<{ command: ToolbarCommand; label: string; Icon: typeof TitleIcon }> = [
  { command: 'heading', label: 'Heading', Icon: TitleIcon },
  { command: 'bulletList', label: 'Bulleted list', Icon: FormatListBulletedIcon },
  { command: 'orderedList', label: 'Numbered list', Icon: FormatListNumberedIcon },
  { command: 'blockquote', label: 'Quote', Icon: FormatQuoteIcon },
];

const HEADING_LEVEL = 3 as const;

/**
 * Rich text input backed by Tiptap. Accepts pasted formatted text — Tiptap's clipboard
 * parser keeps the marks StarterKit knows about and drops everything else — and
 * serializes to an HTML string for storage.
 */
export function RichTextField({
  value,
  onChange,
  label,
  placeholder,
  minHeight = 180,
  disabled = false,
}: RichTextFieldProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editable: !disabled,
    // Tiptap must not render during SSR, so `editor` is null on the first client render.
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.isEmpty ? '' : instance.getHTML());
    },
  });

  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // useEditor does not re-render on transactions by default in Tiptap 3, so the toolbar's
  // active states and the empty check have to be pulled through useEditorState.
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      if (!instance) return null;
      return {
        isEmpty: instance.isEmpty,
        active: {
          bold: instance.isActive('bold'),
          italic: instance.isActive('italic'),
          underline: instance.isActive('underline'),
          strike: instance.isActive('strike'),
          heading: instance.isActive('heading', { level: HEADING_LEVEL }),
          bulletList: instance.isActive('bulletList'),
          orderedList: instance.isActive('orderedList'),
          blockquote: instance.isActive('blockquote'),
        } as Record<ToolbarCommand, boolean>,
      };
    },
  });

  const run = (command: ToolbarCommand) => {
    const chain = editor?.chain().focus();
    if (!chain) return;
    switch (command) {
      case 'bold': chain.toggleBold().run(); break;
      case 'italic': chain.toggleItalic().run(); break;
      case 'underline': chain.toggleUnderline().run(); break;
      case 'strike': chain.toggleStrike().run(); break;
      case 'heading': chain.toggleHeading({ level: HEADING_LEVEL }).run(); break;
      case 'bulletList': chain.toggleBulletList().run(); break;
      case 'orderedList': chain.toggleOrderedList().run(); break;
      case 'blockquote': chain.toggleBlockquote().run(); break;
    }
  };

  const renderGroup = (buttons: typeof MARK_BUTTONS) => (
    <ToggleButtonGroup
      size="small"
      value={buttons.filter((b) => state?.active[b.command]).map((b) => b.command)}
    >
      {buttons.map(({ command, label: title, Icon }) => (
        <ToggleButton
          key={command}
          value={command}
          disabled={disabled || !editor}
          onClick={() => run(command)}
          aria-label={title}
        >
          <Tooltip title={title}>
            <Icon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  const showPlaceholder = Boolean(placeholder) && (!editor || state?.isEmpty !== false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {label && (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.default',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', p: 0.5 }}>
          {renderGroup(MARK_BUTTONS)}
          <Divider flexItem orientation="vertical" sx={{ mx: 0.5 }} />
          {renderGroup(BLOCK_BUTTONS)}
        </Box>
        <Divider />
        <Box
          className="rich-text-field__surface"
          sx={{ position: 'relative', minHeight, maxHeight: 360, overflowY: 'auto', px: 1.5, py: 1 }}
          onClick={() => editor?.chain().focus().run()}
        >
          {showPlaceholder && (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ position: 'absolute', top: 8, left: 12, pointerEvents: 'none' }}
            >
              {placeholder}
            </Typography>
          )}
          <EditorContent editor={editor} />
        </Box>
      </Box>
    </Box>
  );
}
