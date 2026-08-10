import type { Metadata } from 'next'
import { RootLayoutClient } from './RootLayoutClient'

export const metadata: Metadata = {
  title: 'Writual',
  manifest: '/manifest.json',
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
