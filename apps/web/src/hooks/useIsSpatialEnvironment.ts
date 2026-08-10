'use client'

import * as React from 'react'

const WEBSPATIAL_UA_PATTERN = /WebSpatial\/(\S+)/

/** SSR-safe: reads navigator.userAgent, so it can only resolve true after mount. */
export function isSpatialEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false
  return WEBSPATIAL_UA_PATTERN.test(navigator.userAgent)
}

export function useIsSpatialEnvironment(): boolean {
  const [isSpatial, setIsSpatial] = React.useState(false)

  React.useEffect(() => {
    setIsSpatial(isSpatialEnvironment())
  }, [])

  return isSpatial
}
