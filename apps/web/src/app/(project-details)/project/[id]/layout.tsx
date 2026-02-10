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
import { useSideNavCollapsedStore } from '@/state/sideNavCollapsed';

const SIDENAV_WIDTH_EXPANDED = 250;
const SIDENAV_WIDTH_COLLAPSED = 80;

export default function ProjectLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    const collapsed = useSideNavCollapsedStore((s) => s.collapsed);
    const navWidth = collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH_EXPANDED;

    return (
      <Box gap={2} display="flex" flexDirection="row" height="100%" position="relative">
        
          <SideNavComponent />

        <Paper elevation={1} sx={{
          display: "flex",
          //marginTop: "25px",
          flex: 1,
          height: "100%", 
          borderRadius: 2, 
        }}>
          {children}
        </Paper>
      </Box>
    );
  }