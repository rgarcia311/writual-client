'use client';

import * as React from 'react';

/**
 * Renders children only after mount. Use in root layout to avoid MUI/Emotion
 * hydration mismatch (server vs client style injection order).
 */
export function ClientOnlyMuiLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100vw',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      />
    );
  }
  return <>{children}</>;
}
