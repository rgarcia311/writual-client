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

/**
 * Why this is more than a boolean: on PICO Browser the install affordance may live only in the
 * address bar ("Run as a standalone app"), so `beforeinstallprompt` never firing is a normal,
 * actionable state — not a failure. Callers need to tell it apart from "already standalone" and
 * from "installed just now", or they end up rendering nothing and looking broken.
 */
export type InstallPromptStatus =
  /** Already running as an installed/standalone app — nothing left to offer. */
  | 'standalone'
  /** `appinstalled` fired during this session. */
  | 'installed'
  /** `beforeinstallprompt` captured; `promptInstall()` will show the browser UI. */
  | 'available'
  /** No event (yet). The browser may still offer it, or only via its own chrome. */
  | 'unavailable'

/** True when the document is being presented as an installed app rather than a browser tab. */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS/visionOS Safari predates display-mode and exposes a non-standard flag instead.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = React.useState(false)
  const [isStandalone, setIsStandalone] = React.useState(false)

  // Separate from the event listeners below: resolved after mount so SSR and the first client
  // render agree, and kept live because some runtimes flip display-mode without a reload.
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    setIsStandalone(detectStandalone())

    const query = window.matchMedia?.('(display-mode: standalone)')
    if (!query) return

    const onChange = () => setIsStandalone(detectStandalone())
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

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

  const status: InstallPromptStatus = isStandalone
    ? 'standalone'
    : installed
      ? 'installed'
      : installEvent !== null
        ? 'available'
        : 'unavailable'

  return {
    /** True once the browser has decided this page meets PWA-installability criteria. */
    isAvailable: installEvent !== null,
    installed,
    /** True when already running as an installed/standalone app. */
    isStandalone,
    /** Single collapsed state, so callers can branch without recombining the booleans. */
    status,
    promptInstall,
  }
}
