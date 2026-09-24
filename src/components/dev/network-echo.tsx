"use client";

import { use } from "react";

/**
 * Replays the server render's backend GETs from the browser, so every API a
 * page uses appears in the Network tab.
 *
 * The portal renders on the server, which means its data fetches never reach
 * the browser and DevTools has nothing to show. The root layout hands this
 * component the paths that render just fetched, and it re-issues each one
 * through the same-origin proxy — the proxy attaches the bearer token, so each
 * replay is the real authenticated request with the real response body,
 * filterable under Fetch/XHR as `/api/`.
 *
 * THE LIST ARRIVES AS A PROMISE, NOT OVER FETCH. It used to be read back from a
 * route handler, which cannot work on Vercel: that handler is a separate
 * function from the page, so it never sees what the render recorded. Streaming
 * the list down with the page keeps both halves in one process — see
 * src/lib/dev-calls.ts.
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
 * LOCAL DEVELOPMENT ONLY. A deployed build passes null and replays nothing —
 * see ECHO_ENABLED for what running this anywhere else would expose.
 */
export function NetworkEcho({ paths }: { paths: Promise<string[]> | null }) {
  // `use` suspends until the render's list arrives, which is why the layout
  // wraps this in Suspense. A build with the echo off passes null and never
  // suspends at all.
  const list = paths ? use(paths) : [];

  if (list.length > 0 && typeof window !== "undefined") replay(list);

  return null;
}

/**
 * Fired during render rather than from an effect, and deliberately not awaited.
 *
 * Each navigation renders a fresh NetworkEcho with a fresh promise, so there is
 * nothing here to re-run on a dependency change — an effect would only delay
 * the replay by a paint. Double invocation under StrictMode would mean each row
 * twice in the panel; the guard below is what keeps it to one.
 */
const replayed = new WeakSet<string[]>();

function replay(list: string[]) {
  if (replayed.has(list)) return;
  replayed.add(list);

  void (async () => {
    for (const path of list) {
      // The header is the marker: it is what tells you, in the panel, that this
      // entry is an echo of a server render and not traffic the page made on
      // its own.
      await fetch(`/api${path}`, {
        headers: { "x-dev-echo": "1" },
        credentials: "include",
      }).catch(() => {});
    }
  })();
}
