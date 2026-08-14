'use client'

import { useState, useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useUserProfileStore } from '@/state/user'
import { useScreenplayEditorStore } from '@/state/screenplayEditor'
import { HOCUSPOCUS_URL } from '@/lib/config'

const USER_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#009688', '#4CAF50',
  '#FF9800', '#FF5722',
]

const CONNECT_TIMEOUT_MS = 15_000
const MAX_CLOSE_FAILURES = 3

/**
 * Grace period after the app returns to the foreground during which disconnects are not
 * counted toward MAX_CLOSE_FAILURES. A socket closed while the app was suspended is often only
 * *reported* once we wake, so `visibilityState === 'visible'` alone isn't enough to tell a real
 * failure from the tail of a suspend.
 */
const RESUME_GRACE_MS = 10_000

function pickColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

export interface CollabResources {
  ydoc: Y.Doc | null
  provider: HocuspocusProvider | null
  failed: boolean
}

export function useCollaboration(
  projectId: string | undefined,
): CollabResources {
  const userProfile = useUserProfileStore((s) => s.userProfile)
  const setCollabStatus = useScreenplayEditorStore((s) => s.setCollabStatus)
  const setConnectedUsers = useScreenplayEditorStore((s) => s.setConnectedUsers)

  const [resources, setResources] = useState<CollabResources>({
    ydoc: null,
    provider: null,
    failed: false,
  })

  const closeFailuresRef = useRef(0)

  /**
   * Bumped to rebuild the provider after a solo-mode fallback. Standalone headsets suspend the
   * page whenever the user takes the headset off, so `failToSolo` must not be a one-way door —
   * without this, a few on/off cycles would strand the user editing offline for the rest of the
   * session, since the effect otherwise only re-runs when the project or user changes.
   */
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!projectId || !userProfile) {
      setCollabStatus('idle')
      return
    }

    let isFailed = false
    let connectTimer: ReturnType<typeof setTimeout> | null = null
    let lastResumeAt = 0
    /** Whether the solo fallback happened while suspended — see handleWake for why it matters. */
    let failedWhileSuspended = false

    // A fresh provider gets a fresh failure budget — otherwise a retry would inherit the three
    // failures that caused the fallback and give up immediately.
    closeFailuresRef.current = 0

    const teardown = (prov: HocuspocusProvider, doc: Y.Doc) => {
      if (connectTimer) { clearTimeout(connectTimer); connectTimer = null }
      prov.off('status', handleStatus)
      prov.off('awarenessUpdate', handleAwareness)
      prov.destroy()
      doc.destroy()
    }

    const failToSolo = (reason: string) => {
      if (isFailed) return
      isFailed = true
      failedWhileSuspended =
        document.visibilityState !== 'visible' ||
        Date.now() - lastResumeAt < RESUME_GRACE_MS
      console.warn(`[collab] ${reason} — falling back to solo mode`)
      setResources({ ydoc: null, provider: null, failed: true })
      setCollabStatus('idle')
      setConnectedUsers([])
      setTimeout(() => teardown(provider, ydoc), 0)
    }

    /**
     * (Re)arms the connect watchdog. Restarted on wake rather than left running, because a timer
     * scheduled before a suspend is deferred and then fires the instant we resume — which would
     * fail a connection that is actually fine.
     */
    const startConnectTimer = () => {
      if (connectTimer) clearTimeout(connectTimer)
      connectTimer = setTimeout(() => {
        if (!isFailed && provider.status !== 'connected') {
          failToSolo(`Connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s`)
        }
      }, CONNECT_TIMEOUT_MS)
    }

    const ydoc = new Y.Doc()
    const provider = new HocuspocusProvider({
      url: HOCUSPOCUS_URL,
      name: projectId,
      document: ydoc,
      token: async () => {
        const { getAuth } = await import('firebase/auth')
        const auth = getAuth()
        const idToken = await auth.currentUser?.getIdToken()
        return idToken ?? ''
      },
    })

    provider.setAwarenessField('user', {
      name: userProfile.displayName || userProfile.name || 'Anonymous',
      color: pickColor(userProfile.user),
      avatarUrl: null,
    })

    const handleStatus = ({ status }: { status: string }) => {
      if (isFailed) return

      if (status === 'connected') {
        if (connectTimer) { clearTimeout(connectTimer); connectTimer = null }
        closeFailuresRef.current = 0
      }

      if (status === 'disconnected') {
        // Only count disconnects that happen during genuine foreground use. A headset removal
        // (or any OS-level suspend) closes the socket through no fault of the connection, and
        // counting those would let routine hardware use trip the permanent solo fallback.
        const suspendRelated =
          document.visibilityState !== 'visible' ||
          Date.now() - lastResumeAt < RESUME_GRACE_MS

        if (!suspendRelated) {
          closeFailuresRef.current += 1
          if (closeFailuresRef.current >= MAX_CLOSE_FAILURES) {
            failToSolo(`Connection lost ${MAX_CLOSE_FAILURES} times`)
            return
          }
        }
      }

      setCollabStatus(status as 'connecting' | 'connected' | 'disconnected')
    }

    const handleAwareness = ({ states }: { states: Map<number, Record<string, unknown>> }) => {
      const users = Array.from(states.values())
        .filter((s) => s.user)
        .map((s) => s.user as { name: string; color: string; avatarUrl?: string })
      setConnectedUsers(users)
    }

    provider.on('status', handleStatus)
    provider.on('awarenessUpdate', handleAwareness)
    provider.on('authenticationFailed', () => failToSolo('Authentication failed'))

    /**
     * Wake handler. Standalone headsets throttle or suspend the page when the user removes the
     * headset or opens a system menu, and nothing else in the app listens for that.
     */
    const handleWake = () => {
      if (document.visibilityState !== 'visible') return

      lastResumeAt = Date.now()
      closeFailuresRef.current = 0

      if (isFailed) {
        // Deliberately narrow: only auto-recover when the fallback happened while the app was
        // suspended, i.e. when the user cannot have typed anything into the solo document.
        //
        // Recovery remounts the editor (WritualEditor keys its inner tree on
        // `${projectId}-${failed ? 'solo' : 'collab'}`), which swaps in the new Y.Doc and
        // discards whatever was written in solo mode. That is fine for a fallback nobody could
        // have edited through, and data loss for one they could — so a fallback that occurred
        // during genuine foreground use stays latched exactly as it does today.
        if (failedWhileSuspended) setRetryToken((token) => token + 1)
        return
      }

      startConnectTimer()
      if (provider.status !== 'connected') {
        // connect() returns a promise; swallow rejection so a failed reconnect surfaces through
        // the existing status handler rather than as an unhandled rejection.
        void provider.connect().catch(() => {})
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Don't leave a watchdog armed across a suspend; handleWake re-arms it.
        if (connectTimer) {
          clearTimeout(connectTimer)
          connectTimer = null
        }
        return
      }
      handleWake()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleWake)

    startConnectTimer()

    setResources({ ydoc, provider, failed: false })

    return () => {
      // Removed here and not in teardown(): after failToSolo the provider is gone but these
      // listeners must stay live, since they are what lets a later wake recover the session.
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleWake)

      if (!isFailed) {
        teardown(provider, ydoc)
        setResources({ ydoc: null, provider: null, failed: false })
        setCollabStatus('idle')
        setConnectedUsers([])
      }
    }
  }, [projectId, userProfile?.user, retryToken, setCollabStatus, setConnectedUsers])

  return resources
}
