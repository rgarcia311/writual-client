'use client';

import { Box, Button, Link } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCreateProjectModalStore } from '@/state/createProjectModal';
import { SettingsPopover } from '@/components/SettingsPopover';
import { AppLogo } from '../AppLogo';

export function AppTopBar() {
  const openCreateProjectModal = useCreateProjectModalStore((s) => s.openModal);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1,
        padding: 1.5,
        maxHeight: 50,
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        backgroundColor: 'background.default',
      }}
    >
      <Link href="/projects" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
        <AppLogo size={40}/>
      </Link>
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={openCreateProjectModal}
        >
          Create Project
        </Button>
        <SettingsPopover standalone />

      </Box>
     
    </Box>
  );
}
