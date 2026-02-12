'use client'

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Autocomplete, Box, Button, Container, Drawer, IconButton, Link as MuiLink, Paper, TextField, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/system";
import { useState } from "react";
import Image from "next/image";
import { SettingsPopover } from '@/components/SettingsPopover';
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

const SIDENAV_WIDTH_EXPANDED = 300;
const SIDENAV_WIDTH_COLLAPSED = 80;

export const StyledSideNav = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
  height: "100%",
  width: collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH_EXPANDED,
  minWidth: collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH_EXPANDED,
  borderRadius: "10px",
  padding: "5px",
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
      <Box sx={{  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', width: '100%', px: 1, mt: '10px' }}>
          <MuiLink
            component={Link}
            href="/projects"
            sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, textAlign: 'center', height: '70px', textDecoration: 'none', color: 'inherit' }}
          >
            {!collapsed && <Typography fontFamily={'Merriweather'} fontWeight={700} fontSize={20} letterSpacing={4} variant="h5" color="primary">Details</Typography>
            }
          </MuiLink>
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
            <IconButton
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              size="small"
            >
              {collapsed ? <SwitchRightIcon /> : <SwitchLeftIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        {!collapsed && (
          <Autocomplete
            multiple
            freeSolo
            size="small"
            value={searchValue}
            inputValue={searchInputValue}
            onInputChange={(_e, newInputValue) => setSearchInputValue(newInputValue)}
            onChange={(_e, newValue) => setSearchValue(typeof newValue === 'string' ? [newValue] : newValue)}
            options={SEARCH_MENU_ITEMS}
            sx={{ width: '100%', px: 1, '& .MuiOutlinedInput-root': { borderRadius: '50px', backgroundColor: 'action.hover' } }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Project Title, User, etc"
                sx={{ '& .MuiInputBase-input': { py: 0.5 } }}
              />
            )}
          />
        )}
      </Box>
      <Container
        sx={{
          display: 'flex',
          alignItems: collapsed ? 'center' : 'flex-start',
          flexDirection: 'column',
          gap: "10px",
          flex: '1 1 25%',
          minHeight: '50%',
          padding: collapsed ? '8px' : '8px',
          paddingTop: "20px",
         
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
                  size="medium"
                  sx={{ minWidth: 48, '& svg': { fontSize: 28 } }}
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
      </Container>
      <Box
        sx={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: collapsed ? 0.5 : 1.5,
          py: 1,
          gap: 0.5,
        }}
      >
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
