"use client";

import { useEffect } from "react";

import { refreshSession } from "@/lib/http";
import { safeNextPath } from "@/lib/session";

/**
 * The hop that keeps a session alive across a navigation.
 *
 * The access cookie is set with the token's own lifetime (~15 minutes), so it
 * is simply gone after an idle spell — and src/proxy.ts, which is the first
 * thing a navigation meets, cannot mint a new one: it may run at a CDN edge
 * with no shared state, and the backend rotates the refresh token on every
 * call, so two page loads racing there would each present the same token, the
 * second would read as replay, and the whole family gets revoked. That is why
 * the proxy sends the request HERE instead of to /login. This is ordinary
 * client code, so it refreshes through the same single-flight lock in
 * src/lib/http.ts that already keeps an open tab alive, then continues to
 * wherever the user was going.
 *
 * ponytail: the lock is per JS context, so two TABS waking at the same moment
 * still race the rotation and can revoke the family between them. Left alone
 * because losing that race costs exactly what happens today — a trip to
 * /login — and a cross-tab lock (BroadcastChannel, or a Web Lock keyed on the
 * refresh) is the upgrade if it turns out to bite.
 *
 * A full load rather than `router.replace`: the point of the trip is to be
 * re-judged by the proxy holding the new cookie, and a hard navigation is the
 * one thing guaranteed to do that with no client-side route cache in the way.
 */
export default function RefreshSessionPage() {
  useEffect(() => {
    (async () => {
      /*
       * `refreshSession` reporting true is now enough, and it was not always.
       * It used to be paired with a read-back of `document.cookie`, because a
       * token that arrived already expired (clock skew, a backend handing out
       * a zero lifetime) wrote a dead cookie and still reported success — and
       * the trip then bounced proxy → here → proxy forever. The access cookie
       * is HttpOnly now, so that read-back is impossible; the check moved to
       * the one place that can still make it, which refuses a non-positive
       * lifetime with a 400 instead of setting nothing. See
       * ../session/route.ts.
       */
      const live = await refreshSession();

      window.location.replace(
        live
          ? safeNextPath(window.location.search, window.location.origin)
          : "/login",
      );
    })();
  }, []);

  return (
    <main className="flex min-h-svh items-center justify-center">
      {/* h1, not p: it is the only thing on the screen, and a page whose
          heading outline is empty announces as untitled. */}
      <h1 className="text-sm font-normal text-muted-foreground">
        Signing you back in…
      </h1>
    </main>
  );
}
