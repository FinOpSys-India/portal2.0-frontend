import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE, LIVE, backendUrl } from "@/lib/backend";

/**
 * Same-origin proxy in front of the Node backend.
 *
 * The browser talks to `/api/...` on this origin and never to the backend's
 * origin directly. That one decision removes three problems at once, and it
 * needs no change on the backend — which is not ours to change:
 *
 *   - CORS disappears. There is no cross-origin request left to preflight, so
 *     the backend's `CORS_ORIGIN` never has to name this deployment.
 *   - The refresh cookie survives. It is `SameSite=Lax`, which a browser drops
 *     on a cross-site XHR — so a frontend on its own domain would hold a
 *     30-day session it could never spend. Same-origin, it is simply sent.
 *   - The CSRF cookie is readable, which is the whole mechanism: the client has
 *     to echo it back in a header, and it can only do that if it can read it.
 *
 * The `Authorization` header is attached HERE rather than in each caller. The
 * access token arrives in a login response BODY, but server components have no
 * client-side store to read it from — so it is parked in a cookie, and this is
 * the one place that turns that cookie back into the header the backend wants.
 * Callers stay unaware of tokens entirely.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  /**
   * Portal pages render from server components, and a server component cannot
   * mint or refresh a session — it can only read the cookie the browser sent.
   * With no token the fetch layer took the backend's 401 and threw it as an
   * unhandled `ApiError`, so a signed-out visit to any portal page was a
   * runtime error page ("Authentication required.") rather than a trip to the
   * login screen. Guarding here rather than in each page is what makes that
   * true of every route at once, including ones not written yet.
   *
   * Cookie absence IS token expiry: `storeAccessToken` sets Max-Age to the
   * token's own lifetime, so the browser drops it exactly when it stops
   * working.
   *
   * ponytail: expiry lands on /login rather than spending the 30-day refresh
   * cookie, so a session ends at the access token's ~15 minutes. Refreshing
   * here is the obvious upgrade and deliberately not taken: proxy runs with no
   * shared state (it may be deployed to a CDN edge), and the backend rotates
   * the refresh token on every call — so two page loads racing would each
   * present the same token, the second would read as replay, and the whole
   * family gets revoked. The single-flight lock in src/lib/http.ts is what
   * makes that safe on the client and cannot exist here. Move refresh into a
   * route handler the client calls, then redirect through it.
   */
  if (!pathname.startsWith("/api")) {
    // No backend configured (mock mode) means there is no token to obtain — the
    // mocks never set one — and nothing real to protect. Gating here would trap
    // every page behind a /login that loops to an OTP screen no fixture can
    // satisfy, so the whole app is unreachable exactly when it is meant to be
    // "clickable without a server". Skip the gate; it re-arms the moment a real
    // backend is set.
    if (!LIVE) return NextResponse.next();
    return accessToken
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  const target = backendUrl(pathname.replace(/^\/api/, "") + search);

  const headers = new Headers(request.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  // The forwarded Host must be the backend's own, not ours — Express builds
  // redirect URLs and cookie domains from it.
  headers.delete("host");

  // Drop the browser's Origin. This hop is server-to-server, so there is no
  // cross-origin request for the backend to police — which is the whole reason
  // the proxy exists. Forwarding it reintroduces exactly what the proxy removes:
  // the backend's CORS guard rejects any origin not on its allowlist by THROWING
  // (cors → next(err) → unmapped 500), and it runs before the request-id
  // middleware so the 500 comes back without a requestId. A same-origin browser
  // POST still sends Origin, so every client-side write — login first of all —
  // 500s until it is stripped. Absent, the backend's own `if (!origin) allow`
  // path takes over, which is the correct reading of a server-to-server call.
  headers.delete("origin");

  return NextResponse.rewrite(new URL(target), { request: { headers } });
}

export const config = {
  matcher: [
    "/api/:path*",
    /**
     * Everything else that is not public, expressed as what IS public so a
     * portal route added later is guarded by default rather than by remembering
     * to list it. Excluded: the backend proxy above, Next's own assets, the
     * whole (auth) group (`login` also covers `login-v1`, `signup` covers both
     * signup routes), and any path with a dot in it — favicon.ico, the logo,
     * everything else under public/.
     *
     * `.+` and not `.*` leaves `/` itself out: the portal picker is the page a
     * signed-out visitor is supposed to land on.
     */
    "/((?!api|_next|login|signup|otp_page_|forgot_password|accept-invitation|.*\\.).+)",
  ],
};
