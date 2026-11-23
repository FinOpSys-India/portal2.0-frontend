"use client";

import { useSyncExternalStore } from "react";

/**
 * The reader's own time zone, for meeting times.
 *
 * The server renders in its own zone and the browser in the reader's, so a time
 * printed on both would differ and React would refuse to hydrate it. The server
 * snapshot is the firm's working zone, which is where nearly every reader sits;
 * anyone elsewhere sees the page settle into their zone right after it loads.
 */
const OFFICE = "Asia/Kolkata";

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const subscribe = () => () => {};

export function useTimeZone(): string {
  return useSyncExternalStore(subscribe, browserZone, () => OFFICE);
}
