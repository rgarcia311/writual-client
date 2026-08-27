'use client'

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Autocomplete, Badge, Box, Button, Drawer, IconButton, Link as MuiLink, Paper, TextField, Tooltip } from "@mui/material";
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
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { useSideNavCollapsedStore } from '@/state/sideNavCollapsed';
import { useProjectUnreadCount } from '@/hooks/useProjectConversations';

const SIDENAV_LINKS = [
  { segment: 'characters', label: 'Characters', Icon: TheaterComedyIcon },
  { segment: 'notes', label: 'Notes', Icon: StickyNote2Icon },
  { segment: 'outline', label: 'Outline', Icon: AccountTreeIcon },
  { segment: 'screenplay', label: 'Screenplay', Icon: ArticleIcon },
  { segment: 'chat', label: 'Chat', Icon: ChatBubbleIcon },
] as const;

/** Cap on the unread badge — past this it reads '99+' rather than growing the bubble. */
const UNREAD_BADGE_MAX = 99;

/**
 * Unread bubble pinned to the top-right of the chat link. Rendered only at 1 or more: an
 * always-present zero is noise, and `Badge`'s own `invisible` still reserves the space.
 */
function UnreadBubble({
  count,
  overlap,
  children,
}: {
  count: number;
  overlap: 'circular' | 'rectangular';
  children: React.ReactElement;
}) {
  if (count < 1) return children;
  return (
    <Badge
      badgeContent={count > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : count}
      color="error"
      overlap={overlap}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      aria-label={`${count} unread chat ${count === 1 ? 'message' : 'messages'}`}
      sx={{
        // The rail scrolls, so a badge hung the default half-width past the corner would be
        // clipped or push a horizontal scrollbar. This keeps it over the link's own corner.
        '& .MuiBadge-badge': {
          fontSize: 10,
          minWidth: 18,
          height: 18,
          padding: '0 4px',
          transform: 'translate(25%, -25%)',
        },
      }}
    >
      {children}
    </Badge>
  );
}

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

/** Pixels of real depth this panel sits in front of page content on spatial platforms. */
const XR_SIDENAV_BACK_PX = 16;

export const StyledSideNav = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
  // `--xr-back` (applied below) only takes effect on positioned elements.
  position: 'relative',
  height: "100%",
  width: collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH_EXPANDED,
  minWidth: collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH_EXPANDED,
  borderRadius: "10px",
  padding: collapsed ? theme.spacing(0.5, 0.25) : theme.spacing(1),
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
  const unreadChatCount = useProjectUnreadCount(projectId);

  const linkHref = (segment: string) =>
    projectId ? `/project/${projectId}/${segment}` : '/projects';

  return (
    <StyledSideNav
      elevation={2}
      collapsed={collapsed}
      data-tour="side-nav"
      enable-xr=""
      style={
        {
          '--xr-back': `${XR_SIDENAV_BACK_PX}px`,
          '--xr-background-material': 'translucent',
        } as React.CSSProperties
      }
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          width: '100%',
          px: collapsed ? 0 : 1,
          minHeight: 'var(--app-chrome-row-height, 46px)',
          pt: 0,
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
            minHeight: 'var(--app-chrome-row-height, 46px)',
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
          // Chat is the only link with a count behind it; every other one renders unwrapped.
          const unreadCount = segment === 'chat' ? unreadChatCount : 0;
          if (collapsed) {
            return (
              // Badge outside the tooltip, not inside: `Tooltip` attaches its ref to its direct
              // child, and `UnreadBubble` drops out of the tree entirely at a zero count.
              <UnreadBubble key={segment} count={unreadCount} overlap="circular">
                <Tooltip title={label} placement="right">
                  <IconButton
                    component={Link}
                    href={href}
                    color="primary"
                    size="small"
                    data-tour={`side-nav-${segment}`}
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
              </UnreadBubble>
            );
          }
          return (
            <UnreadBubble key={segment} count={unreadCount} overlap="rectangular">
              <Button
                component={Link}
                href={href}
                variant="text"
                color="primary"
                startIcon={<Icon />}
                data-tour={`side-nav-${segment}`}
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
            </UnreadBubble>
          );
        })}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : { xs: 'column', md: 'row' },
          alignItems: collapsed ? 'center' : { xs: 'stretch', md: 'center' },
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: collapsed ? 0.5 : 1,
          px: collapsed ? 0 : 1,
          py: 1.5,
          flexShrink: 0,
          width: '100%',
          minWidth: 0,
          containerType: 'inline-size',
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
              size="small"
              startIcon={<AddIcon />}
              onClick={openCreateProjectModal}
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                maxWidth: '100%',
                width: '100%',
                whiteSpace: 'nowrap',
                fontSize: 'clamp(0.625rem, 5.75cqw, 0.8125rem)',
                lineHeight: 1.25,
                px: 'clamp(6px, 2.25cqw, 12px)',
                py: 0.75,
                '& .MuiButton-startIcon': {
                  marginRight: 'clamp(4px, 1.25cqw, 8px)',
                  marginLeft: 0,
                },
                '& .MuiButton-startIcon > svg': {
                  fontSize: 'clamp(1rem, 4.5cqw, 1.125rem)',
                },
              }}
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
