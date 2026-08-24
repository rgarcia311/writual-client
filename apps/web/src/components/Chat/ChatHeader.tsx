'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import GroupIcon from '@mui/icons-material/Group';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TuneIcon from '@mui/icons-material/Tune';
import type { ConversationThread } from '@/interfaces/chat';
import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints';
import {
  ManageAccessDialog,
  PermissionChip,
  summarizeAspects,
  summarizeScreenplayGrant,
} from '@/components/CollaboratorAccess';
import type { ParticipantAccess, SharableScreenplayDocument } from '@hooks/useProjectSharing';

interface Props {
  thread: ConversationThread | undefined;
  currentUserUid: string;
  typingUsers: string[];
  projectId: string;
  /** How a given uid reaches this project — drives the permission badge and the access editor. */
  participantAccess: (uid: string) => ParticipantAccess;
  /** The project's screenplays, so the access editor can offer them individually. */
  screenplayDocuments: SharableScreenplayDocument[];
  /** Only the project's owner may re-grant someone else's access. */
  canManageAccess: boolean;
  onMenuClick: () => void;
  onLeaveConversation?: () => void;
}

export function ChatHeader({
  thread,
  currentUserUid,
  typingUsers,
  projectId,
  participantAccess,
  screenplayDocuments,
  canManageAccess,
  onMenuClick,
  onLeaveConversation,
}: Props) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [accessOpen, setAccessOpen] = React.useState(false);

  const typingText = typingUsers.length === 1
    ? `${typingUsers[0]} is typing…`
    : typingUsers.length > 1
      ? `${typingUsers.length} people are typing…`
      : null;

  const isDirect = thread?.type === 'direct';
  const isGeneral = thread?.name === 'General';

  const other = isDirect
    ? thread?.participants.find((p) => p.uid !== currentUserUid)
    : null;

  const title = isDirect
    ? (other?.displayName ?? other?.name ?? 'Unknown')
    : (thread?.name ?? 'Group Chat');

  const subtitle = !isDirect && thread
    ? thread.participants
        .map((p) => p.displayName ?? p.name ?? p.uid)
        .join(', ')
    : null;

  const access = other ? participantAccess(other.uid) : null;
  const collaborator = access?.collaborator ?? null;

  // What this person was actually let into, spelled out under their name: the level, then the
  // aspects, then which screenplays when the grant is narrower than all of them.
  const accessDetail = collaborator
    ? [
        summarizeAspects(
          summarizeScreenplayGrant(collaborator, screenplayDocuments)
            ? collaborator.aspects.filter((aspect) => aspect !== 'screenplay')
            : collaborator.aspects,
        ),
        summarizeScreenplayGrant(collaborator, screenplayDocuments),
      ].filter(Boolean).join(' · ')
    : access?.role === 'owner'
      ? 'Owns this project'
      : access?.role === 'legacy-share'
        ? 'Shared with full access'
        : null;

  const avatarContent = isDirect
    ? title.charAt(0).toUpperCase()
    : null;

  const canShowMenu = thread && !isDirect && !isGeneral;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
        minHeight: 64,
      }}
    >
      <IconButton
        sx={{ display: 'none', [`@media ${MOBILE_MEDIA_QUERY}`]: { display: 'inline-flex' } }}
        onClick={onMenuClick}
        size="small"
      >
        <MenuIcon />
      </IconButton>
      {thread && (
        <Avatar sx={{ width: 40, height: 40 }}>
          {isDirect ? avatarContent : <GroupIcon fontSize="small" />}
        </Avatar>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {thread ? title : 'Select a conversation'}
          </Typography>
          {access && (access.role || collaborator) && (
            <PermissionChip
              level={collaborator?.permissionLevel ?? 'edit'}
              role={access.role ?? undefined}
            />
          )}
        </Box>
        {accessDetail && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {accessDetail}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {subtitle}
          </Typography>
        )}
        {typingText && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {typingText}
          </Typography>
        )}
      </Box>
      {canManageAccess && collaborator && (
        <Tooltip title="Manage project access">
          <IconButton size="small" onClick={() => setAccessOpen(true)} aria-label="Manage project access">
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {canManageAccess && collaborator && (
        <ManageAccessDialog
          open={accessOpen}
          onClose={() => setAccessOpen(false)}
          projectId={projectId}
          collaborator={collaborator}
          personLabel={title}
          screenplayDocuments={screenplayDocuments}
        />
      )}
      {canShowMenu && (
        <>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem disabled sx={{ fontWeight: 600, fontSize: 12, color: 'text.secondary' }}>
              Members
            </MenuItem>
            {thread?.participants.map((p) => {
              const memberAccess = participantAccess(p.uid);
              return (
                <MenuItem key={p.uid} disabled sx={{ fontSize: 13, gap: 1, opacity: 1 }}>
                  <Box component="span" sx={{ flex: 1 }}>{p.displayName ?? p.name ?? p.uid}</Box>
                  {(memberAccess.role || memberAccess.collaborator) && (
                    <PermissionChip
                      level={memberAccess.collaborator?.permissionLevel ?? 'edit'}
                      role={memberAccess.role ?? undefined}
                    />
                  )}
                </MenuItem>
              );
            })}
            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                onLeaveConversation?.();
              }}
              sx={{ color: 'error.main', mt: 1 }}
            >
              Leave Group
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
}
