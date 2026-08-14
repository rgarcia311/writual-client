'use client'

import * as React from 'react'
import { getRuntime, type WebSpatialRuntimeType } from '@webspatial/core-sdk'
import { WebSpatialRuntime } from '@webspatial/react-sdk'

/**
 * Runtime detection, delegated to the SDK rather than sniffed by hand.
 *
 * This previously tested `navigator.userAgent` against /WebSpatial\/(\S+)/. That token is not
 * what real runtimes actually advertise: the SDK looks for `WSAppShell/<version>` (packaged /
 * hybrid, e.g. visionOS) or `PicoWebApp/<version>` (browser-mode standalone on PICO OS) — see
 * `parseShellToken` in @webspatial/core-sdk. A bare `WebSpatial/` prefix is only ever set by
 * the SDK's own iframe fallback emulation, so the old regex would have reported `false` on an
 * actual PICO OS 6 standalone launch — the exact case this app is targeting.
 *
 * `getRuntime()` returns `{ type, shellVersion }` where type is 'visionos' | 'picoos' |
 * 'puppeteer' | null, and is documented SSR-safe (no navigator → `{ type: null }`, no throw).
 * It is marked internal to core-sdk, but core-sdk is a direct dependency here and it is the
 * only way to read *which* runtime we are on; `WebSpatialRuntime.supports()` is the public
 * probe for what that runtime can do.
 */

export type SpatialRuntimeType = WebSpatialRuntimeType

export interface SpatialRuntime {
  /** Which spatial runtime is hosting the page, or null on an ordinary flat browser. */
  type: SpatialRuntimeType
  /** Shell version parsed from the UA token, when the runtime advertises one. */
  shellVersion: string | null
  /** True on any spatial runtime. */
  isSpatial: boolean
  /** True specifically on PICO OS, whose capability set differs from visionOS. */
  isPicoOs: boolean
  /**
   * Capability probe — e.g. `supports('-xr-back')`, `supports('initScene')`,
   * `supports('WindowScene')`. Always false before mount and on flat browsers.
   */
  supports: (capability: string) => boolean
}

const FLAT: SpatialRuntime = {
  type: null,
  shellVersion: null,
  isSpatial: false,
  isPicoOs: false,
  supports: () => false,
}

/** SSR-safe: reads navigator.userAgent, so it can only resolve true after mount. */
export function isSpatialEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false
  return getRuntime().type !== null
}

/**
 * Resolved after mount, never during SSR, so the server and first client render agree.
 * Anything that must differ between flat and spatial has to tolerate one flat frame.
 */
export function useSpatialRuntime(): SpatialRuntime {
  const [runtime, setRuntime] = React.useState<SpatialRuntime>(FLAT)

  React.useEffect(() => {
    if (typeof navigator === 'undefined') return

    const { type, shellVersion } = getRuntime()
    if (type === null) return

    setRuntime({
      type,
      shellVersion,
      isSpatial: true,
      isPicoOs: type === 'picoos',
      supports: (capability: string) => WebSpatialRuntime.supports(capability),
    })
  }, [])

  return runtime
}

export function useIsSpatialEnvironment(): boolean {
  return useSpatialRuntime().isSpatial
}
