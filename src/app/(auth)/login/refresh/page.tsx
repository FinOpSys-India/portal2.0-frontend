"use client";

import { useEffect } from "react";

import { ACCESS_TOKEN_COOKIE } from "@/lib/backend";
import { refreshSession } from "@/lib/http";

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
       * `refreshSession` reporting true is not enough on its own — the cookie
       * it wrote is what the proxy will actually read on the next hop, so that
       * is what gets checked. Without this, a token that arrives already
       * expired (a clock skew, a backend handing out a zero lifetime) would
       * bounce proxy → here → proxy forever; with it, the trip ends at /login
       * after one pass.
       */
      const live =
        (await refreshSession()) &&
        document.cookie
          .split("; ")
          .some((row) => row.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

      window.location.replace(live ? nextPath() : "/login");
    })();
  }, []);

  return (
    <main className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you back in…</p>
    </main>
  );
}

/**
 * Where to continue, from `?next=`.
 *
 * Read from the URL bar, so it is untrusted: only a same-origin PATH is
 * followed. `//evil.example` is a protocol-relative URL that `location.replace`
 * would happily treat as another origin, which would turn an expired session
 * into an open redirect off a link anyone can send.
 */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}
