'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { sanitizeRichTextHtml } from './sanitizeRichText';
//import './richTextField.css';

interface RichTextContentProps {
  /** HTML string produced by RichTextField; sanitized before it is rendered. */
  html: string;
  sx?: SxProps<Theme>;
  className?: string;
}

/** Read-only renderer for stored note HTML. */
export function RichTextContent({ html, sx, className }: RichTextContentProps) {
  // Sanitizing needs DOM APIs, so it only runs after mount; SSR emits an empty shell.
  const [safeHtml, setSafeHtml] = React.useState('');
  React.useEffect(() => {
    setSafeHtml(sanitizeRichTextHtml(html));
  }, [html]);

  return (
    <Box
      //className={['rich-text-content', className].filter(Boolean).join(' ')}
      sx={sx}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
