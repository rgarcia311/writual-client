import type { Metadata, Viewport } from 'next'
import { RootLayoutClient } from './RootLayoutClient'

export const metadata: Metadata = {
  title: 'Writual',
  manifest: '/manifest.json',
}

/**
 * Next.js 14+ wants viewport config in its own export, not folded into `metadata`.
 * `maximumScale: 5` rather than 1 so pinch-zoom stays available.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
