'use client'

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Box, Container, CssBaseline } from '@mui/material';
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SSRProvider } from '@webspatial/react-sdk';
import './styles/global.scss'
// Mobile rules for every route; project routes re-import it, which webpack dedupes.
import '../styles/mobileLayout.css'
import '@fontsource/lato/100.css'
import '@fontsource/lato/300.css'
import '@fontsource/lato'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css'
import '@fontsource/rubik'
import '@fontsource/manrope'
import '@fontsource/varela-round'
import '@fontsource/lora'
import '@fontsource/merriweather'
import { getTheme } from '../themes/themes';
import { ThemeToggleProvider } from '../themes/ThemeToggleContext';
import { CreateProjectWrapper } from '../components/CreateProjectWrapper';
import { AppTopBar } from '../components/AppTopBar';
import { ClientOnlyMuiLayout } from '../components/ClientOnlyMuiLayout';
import { WalkthroughProvider } from '../components/Walkthrough';

/**
 * Shared query defaults.
 *
 * The screenplay page is the reason these exist: with React Query's zero `staleTime`, every return
 * to a project refetched its whole script before anything could paint, and a background refetch on
 * window focus did it again. A short staleness window plus a longer cache lifetime lets a revisit
 * render from what is already in memory while any genuinely stale read happens behind it. Mutations
 * that invalidate their keys still refetch immediately — `staleTime` does not gate invalidation.
 */
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function isProjectDetailsRoute(pathname: string | null): boolean {
  return pathname != null && /^\/project\/[^/]+/.test(pathname);
}

/** Pre-auth routes: the top bar's Create Project and settings actions have nothing to act on. */
const CHROMELESS_ROUTES = ['/'];

export function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const { theme: isLightMode, setTheme, appliedTheme } = getTheme();
  const showTopBar =
    !CHROMELESS_ROUTES.includes(pathname ?? '') && !isProjectDetailsRoute(pathname);

  return (
    <SSRProvider>
      <ClientOnlyMuiLayout>
        <QueryClientProvider client={client}>
          <ThemeProvider theme={appliedTheme}>
            <ThemeToggleProvider value={{ isLightMode, setTheme }}>
              <CssBaseline />
              <Box
                sx={{
                  gap: 3,
                  display: "flex",
                  flexDirection: "row",
                  width: "100%",
                  maxWidth: "100vw",
                  height: "100%",
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", minHeight: 0, minWidth: 0 }}>
                  <Container maxWidth={false} disableGutters sx={{ display: "flex", height: "100%", flexDirection: "column", resize: "vertical", margin: "0px", width: "100%", maxWidth: "100%", minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                    {showTopBar && <AppTopBar />}
                    {children}
                  </Container>
                </Box>
              </Box>
              <CreateProjectWrapper />
              <WalkthroughProvider />
            </ThemeToggleProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ClientOnlyMuiLayout>
    </SSRProvider>
  );
}
