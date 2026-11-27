"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

const REFRESH_MS = 60_000;
const MIN_GAP_MS = 20_000;

/**
 * Re-reads the page now and then, so a change someone else made (a company
 * set Inactive, a project reassigned) reaches a screen that is already open.
 *
 * POLLING, NOT A PUSH CHANNEL (Nov 27). Status changes are rare and the server
 * already refuses work on anything inactive, so a minute's lag is cosmetic;
 * pushing these tables over Supabase would need a second copy of the
 * company-scope rules there. Chat, which has to be instant, keeps its socket.
 *
 * Same clock as `LiveBell`: only while the tab is visible, catching up at once
 * when it is shown again, with a floor between refreshes. `router.refresh()`
 * keeps client state, so a half-typed form or an open dialog survives it.
 */
export function LiveRefresh() {
  const router = useRouter();

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    // The page was just rendered from fresh data, so the first refresh waits.
    let lastAt = Date.now();

    const refresh = () => {
      if (Date.now() - lastAt < MIN_GAP_MS) return;
      lastAt = Date.now();
      router.refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        timer ??= setInterval(refresh, REFRESH_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
