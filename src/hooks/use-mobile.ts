import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * Tracks the mobile breakpoint.
 *
 * `useSyncExternalStore` rather than shadcn's shipped state-in-an-effect
 * version: matchMedia is an external store, and reading it this way avoids
 * the cascading render React 19 warns about. Server snapshot is `false`, so
 * SSR renders the desktop layout — matching the old behaviour where the
 * initial state was undefined and coerced to false.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
