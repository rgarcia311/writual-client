'use client'

import * as React from 'react'

/**
 * Non-standard Chromium event (no TS DOM lib entry). Fires once the browser has independently
 * decided the page meets PWA-installability criteria (valid manifest + secure context) — this
 * hook can only offer an in-app trigger for that decision, not force it. Safari/visionOS never
 * fires this event; there, installation only happens via the Share sheet outside page JS.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = React.useState(false)

  React.useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setInstallEvent(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = React.useCallback(async () => {
    if (!installEvent) return null
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    return choice
  }, [installEvent])

  return {
    /** True once the browser has decided this page meets PWA-installability criteria. */
    isAvailable: installEvent !== null,
    installed,
    promptInstall,
  }
}
