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

  useEffect(() => {
    if (!projectId || !userProfile) {
      setCollabStatus('idle')
      return
    }

    let isFailed = false
    let connectTimer: ReturnType<typeof setTimeout> | null = null

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
      console.warn(`[collab] ${reason} — falling back to solo mode`)
      setResources({ ydoc: null, provider: null, failed: true })
      setCollabStatus('idle')
      setConnectedUsers([])
      setTimeout(() => teardown(provider, ydoc), 0)
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
        closeFailuresRef.current += 1
        if (closeFailuresRef.current >= MAX_CLOSE_FAILURES) {
          failToSolo(`Connection lost ${MAX_CLOSE_FAILURES} times`)
          return
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

    connectTimer = setTimeout(() => {
      if (!isFailed && provider.status !== 'connected') {
        failToSolo(`Connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s`)
      }
    }, CONNECT_TIMEOUT_MS)

    setResources({ ydoc, provider, failed: false })

    return () => {
      if (!isFailed) {
        teardown(provider, ydoc)
        setResources({ ydoc: null, provider: null, failed: false })
        setCollabStatus('idle')
        setConnectedUsers([])
      }
    }
  }, [projectId, userProfile?.user, setCollabStatus, setConnectedUsers])

  return resources
}
