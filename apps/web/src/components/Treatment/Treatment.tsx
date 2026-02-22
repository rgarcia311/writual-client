'use client';

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Box } from '@mui/material';
import { EditorPaper } from './EditorPaper';
import { TreatmentToolbar } from './TreatmentToolbar';


interface TreatmentProps {
  /** Optional initial HTML or JSON content */
  initialContent?: string;
  /** Optional placeholder when editor is empty */
  placeholder?: string;
  /** Minimum height of the editor area */
  minHeight?: number | string;
}

export function Treatment({
  initialContent = '',
  placeholder = 'Start writing your treatment...',
  minHeight = 400,
}: TreatmentProps) {


  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: initialContent || '<p></p>',
    editorProps: {
      attributes: {
        'data-placeholder': placeholder,
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        //justifyContent: 'center', 
        alignItems: 'center'
      }}
    >
      <Box sx={{ width: 700}}>
        <TreatmentToolbar editor={editor} />
      </Box>
      <Box
        sx={{
          width: "60%",
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 1
        }}
      >
        <EditorPaper>
          <EditorContent editor={editor} />
        </EditorPaper>
      </Box>
    </Box>
  );
}
