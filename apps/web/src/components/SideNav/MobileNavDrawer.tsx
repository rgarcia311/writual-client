'use client';

import * as React from 'react';
import Drawer from '@mui/material/Drawer';
import { usePathname } from 'next/navigation';
import { SideNavComponent } from './SideNav';
import { useMobileNavStore } from '@/state/mobileNav';

/**
 * Mobile stand-in for the persistent side rail, opened from the breadcrumb bar's menu button.
 * Rendered *instead of* `SideNavComponent`, never alongside it — two live instances would
 * duplicate the walkthrough's `data-tour="side-nav"` anchor.
 */
export function MobileNavDrawer() {
  const pathname = usePathname();
  const open = useMobileNavStore((s) => s.open);
  const setOpen = useMobileNavStore((s) => s.setOpen);

  // A link inside the drawer changes the route but not this component's mount state, so without
  // this the drawer would stay open over the page it just navigated to.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={() => setOpen(false)}
      ModalProps={{ keepMounted: true }}
      sx={{
        '& .MuiDrawer-paper': {
          width: 260,
          p: 0.5,
          bgcolor: 'transparent',
          boxShadow: 'none',
          border: 'none',
          overflow: 'hidden',
        },
      }}
    >
      <SideNavComponent />
    </Drawer>
  );
}
