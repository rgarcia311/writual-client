"use client"

import * as React from 'react';
import { Box, Paper } from '@mui/material';
import '@fontsource/lato/100.css'
import '@fontsource/lato/300.css'
import '@fontsource/lato'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css';
import '@fontsource/varela-round';

import { SideNavComponent } from '@/components/SideNav';

export default function ProjectLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          gap: 1,
          p: 1,
        }}
      >
          <SideNavComponent />
        <Paper elevation={1} sx={{
          display: "flex",
          flex: 1,
          height: "100%",
          minWidth: 0,
          overflow: "hidden",
          borderRadius: 2,
        }}>
          {children}
        </Paper>
      </Box>
    );
  }