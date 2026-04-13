'use client'

import { useState, useEffect } from 'react'
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
}

/**
 * Manages the Yjs document and Hocuspocus provider lifecycle.
 *
 * Both Viewers and Editors connect so Viewers receive live document
 * updates. The caller controls `editable` on the editor independently.
 *
 * Instantiation happens inside a useEffect (not a useState lazy
 * initializer) to stay Strict-Mode-safe: React 18 will mount → unmount
 * → remount, and the cleanup correctly destroys the old instances while
 * the second mount creates fresh ones.
 */
export function useCollaboration(
  projectId: string | undefined,
): CollabResources {
  const userProfile = useUserProfileStore((s) => s.userProfile)
  const setCollabStatus = useScreenplayEditorStore((s) => s.setCollabStatus)
  const setConnectedUsers = useScreenplayEditorStore((s) => s.setConnectedUsers)

  const [resources, setResources] = useState<CollabResources>({
    ydoc: null,
    provider: null,
  })

  useEffect(() => {
    if (!projectId || !userProfile) {
      setCollabStatus('idle')
      return
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

    setResources({ ydoc, provider })

    return () => {
      provider.off('status', handleStatus)
      provider.off('awarenessUpdate', handleAwareness)
      provider.destroy()
      ydoc.destroy()
      setResources({ ydoc: null, provider: null })
      setCollabStatus('idle')
      setConnectedUsers([])
    }
  }, [projectId, userProfile?.user, setCollabStatus, setConnectedUsers])

  return resources
}
