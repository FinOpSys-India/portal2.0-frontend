"use client";

import { BASE } from "@/lib/http";

/**
 * Says so, on screen, when the app is answering from fixtures.
 *
 * Without this the two modes are indistinguishable: the tables fill, the
 * dialogs submit, and every write resolves against `mock.ok()` after a 250ms
 * delay. An invitation "sent" that way reports success and makes no request at
 * all — which is exactly how an afternoon gets spent looking for an email that
 * was never going to arrive.
 *
 * Deliberately a CLIENT component reading the client's own `BASE`. That is the
 * value the writes branch on, and it is the one that can disagree with the
 * server's: only `NEXT_PUBLIC_*` is inlined into the browser bundle, so a
 * deployment configured under the server-only name renders live rows while
 * every button quietly mocks. This badge shows the browser's answer, so that
 * split is visible rather than inferred.
 */
export function MockBadge() {
  if (BASE) return null;

  return (
    <span
      // `title` rather than a tooltip component: this is a dev aid, and it must
      // not pull an interactive dependency into every portal shell.
      title="NEXT_PUBLIC_API_URL is not set. Reads are fixtures and writes do nothing."
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
    >
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      Mock data
    </span>
  );
}
