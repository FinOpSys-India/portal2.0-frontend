"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { ECHO_ENABLED } from "@/lib/dev-calls";

/**
 * Replays the server render's backend GETs from the browser, so every API a
 * page uses appears in the Network tab.
 *
 * The portal renders on the server, which means its data fetches never reach
 * the browser and DevTools has nothing to show. This asks /dev-echo what the
 * render just fetched and re-issues each path through the same-origin proxy —
 * the proxy attaches the bearer token, so each replay is the real authenticated
 * request with the real response body, filterable under Fetch/XHR as `/api/`.
 *
 * READS ONLY, and that is not a detail: the recorder only ever sees GETs, so
 * there is no write here to fire twice. Writes already happen in the browser
 * (dialogs, forms) and are in the Network tab without help.
 *
 * SEQUENTIAL, not Promise.all. The backend's pg pool is ten connections wide
 * and src/lib/http.ts caps its own fan-out at eight for that reason; a parallel
 * replay would be a second unbounded fan-out racing the render that produced
 * it. One at a time also keeps the panel in render order.
 *
 * These are DUPLICATE requests — the page already has its data. Timings here
 * are not the page's timings.
 *
 * Always on locally; on a deployed build only with NEXT_PUBLIC_API_ECHO=1 —
 * see ECHO_ENABLED for what turning that on exposes.
 */
export function NetworkEcho() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if (!ECHO_ENABLED) return;

    let cancelled = false;

    (async () => {
      const res = await fetch("/dev-echo").catch(() => null);
      if (!res?.ok || cancelled) return;

      const { paths } = (await res.json().catch(() => ({ paths: [] }))) as {
        paths?: string[];
      };

      for (const path of paths ?? []) {
        if (cancelled) return;
        // The header is the marker: it is what tells you, in the panel, that
        // this entry is an echo of a server render and not traffic the page
        // made on its own.
        await fetch(`/api${path}`, {
          headers: { "x-dev-echo": "1" },
          credentials: "include",
        }).catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-runs on navigation: a client-side route change renders new server
    // components, which fill the buffer again.
  }, [pathname, search]);

  return null;
}
