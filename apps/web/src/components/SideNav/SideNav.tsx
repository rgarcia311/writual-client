'use client'

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Autocomplete, Box, Button, Drawer, IconButton, Link as MuiLink, Paper, TextField, Tooltip } from "@mui/material";
import { styled } from "@mui/system";
import { useState } from "react";
import AddIcon from '@mui/icons-material/Add';
import { SettingsPopover } from '@/components/SettingsPopover';
import { AppLogo } from '@/components/AppLogo';
import { FeatureGate } from '@/components/Auth/FeatureGate';
import SwitchLeftIcon from '@mui/icons-material/SwitchLeft';
import SwitchRightIcon from '@mui/icons-material/SwitchRight';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ArticleIcon from '@mui/icons-material/Article';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { useSideNavCollapsedStore } from '@/state/sideNavCollapsed';

const SIDENAV_LINKS = [
  { segment: 'characters', label: 'Characters', Icon: TheaterComedyIcon },
  { segment: 'outline', label: 'Outline', Icon: AccountTreeIcon },
  { segment: 'treatment', label: 'Treatment', Icon: ArticleIcon },
  { segment: 'screenplay', label: 'Screenplay', Icon: ArticleIcon },
  { segment: 'chat', label: 'Chat', Icon: ChatBubbleIcon },
] as const;

/** Extract project id from pathname like /project/abc123 or /project/abc123/outline */
function getProjectIdFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'project' && segments[1]) return segments[1];
  return null;
}

const SEARCH_MENU_ITEMS = ['Project', 'Scenes', 'Characters'];

const SIDENAV_WIDTH_EXPANDED = 240;
const SIDENAV_WIDTH_COLLAPSED = 45;

export const StyledSideNav = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
  height: "100%",
  width: collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH_EXPANDED,
  minWidth: collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH_EXPANDED,
  borderRadius: "10px",
  padding: collapsed ? theme.spacing(0.5, 0.25) : '5px',
  display: "flex",
  flexDirection: "column",
  gap: 1,
  justifyContent: "space-between",
  backgroundColor: theme.palette.background.default,
  transition: 'width 225ms ease-in-out',
  zIndex: 4,
}));

interface SideNavComponentProps {
  /** @deprecated Theme is now in Settings popover */
  isLightMode?: boolean;
  /** @deprecated Theme is now in Settings popover */
  onThemeToggle?: () => void;
}

export const SideNavComponent = (_props?: SideNavComponentProps) => {
  const pathname = usePathname();
  const projectId = getProjectIdFromPathname(pathname);
  const collapsed = useSideNavCollapsedStore((s) => s.collapsed);
  const toggleCollapsed = useSideNavCollapsedStore((s) => s.toggle);
  const [searchValue, setSearchValue] = React.useState<string[]>([]);
  const [searchInputValue, setSearchInputValue] = React.useState('');
  const openCreateProjectModal = useCreateProjectModalStore((s) => s.openModal);

  const linkHref = (segment: string) =>
    projectId ? `/project/${projectId}/${segment}` : '/projects';

  return (
    <StyledSideNav elevation={2} collapsed={collapsed}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          width: '100%',
          px: collapsed ? 0 : 1,
          pt: 1,
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        <MuiLink
          component={Link}
          href="/projects"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            minWidth: 0,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <AppLogo size={collapsed ? 22 : 30} showWordmark={!collapsed} loading="eager" />
        </MuiLink>
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            size={collapsed ? 'small' : 'medium'}
            sx={collapsed ? { p: 0.25 } : undefined}
          >
            {collapsed ? <SwitchRightIcon /> : <SwitchLeftIcon />}
          </IconButton>
        </Tooltip>
      </Box>
     
      <Box
        sx={{
          display: 'flex',
          alignItems: collapsed ? 'center' : 'flex-start',
          flexDirection: 'column',
          gap: '10px',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          width: '100%',
          px: collapsed ? 0 : '8px',
          pt: 2,
        }}
      >
        {SIDENAV_LINKS.map(({ segment, label, Icon }) => {
          const href = linkHref(segment);
          if (collapsed) {
            return (
              <Tooltip key={segment} title={label} placement="right">
                <IconButton
                  component={Link}
                  href={href}
                  color="primary"
                  size="small"
                  sx={{
                    minWidth: 32,
                    width: 32,
                    height: 32,
                    p: 0.5,
                    '& svg': { fontSize: 20 },
                  }}
                >
                  <Icon />
                </IconButton>
              </Tooltip>
            );
          }
          return (
            <Button
              key={segment}
              component={Link}
              href={href}
              variant="text"
              color="primary"
              startIcon={<Icon />}
              sx={{
                justifyContent: 'flex-start',
                minWidth: '200px',
                borderRadius: '16px',
                textTransform: 'capitalize',
                fontSize: '1.125rem',
                '& .MuiButton-startIcon': { marginRight: '20px' },
              }}
            >
              {label}
            </Button>
          );
        })}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: collapsed ? 0.5 : 1,
          px: collapsed ? 0 : 1,
          py: 1.5,
          flexShrink: 0,
          width: '100%',
        }}
      >
        <FeatureGate minTier="spec">
          {collapsed ? (
            <Tooltip title="Create project" placement="right">
              <IconButton
                color="primary"
                onClick={openCreateProjectModal}
                aria-label="Create project"
                size="small"
                sx={{
                  minWidth: 32,
                  width: 32,
                  height: 32,
                  p: 0.5,
                }}
              >
                <AddIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={openCreateProjectModal}
              sx={{ flex: 1, minWidth: 0 }}
            >
              Create Project
            </Button>
          )}
        </FeatureGate>
        <SettingsPopover />
      </Box>
    </StyledSideNav>
  );
};

export const DrawerComponent = () => {
  const [open, setOpen] = useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };
  return (
    <Drawer anchor="left" open={open} onClose={toggleDrawer(false)}>
      <SideNavComponent />
    </Drawer>
  );
};
