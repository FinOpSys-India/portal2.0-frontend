import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { landingPathForRole, type Role } from "@/lib/api";
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, backendUrl } from "@/lib/backend";

/**
 * Which role each portal belongs to. A prefix that is not listed — `/`, the
 * onboarding group, the shared 1.0 routes like `/list_of_customers` that render
 * different columns per role — is open to any signed-in session.
 */
const PORTAL_ROLE: Record<string, Role> = {
  "/admin": "ADMIN",
  "/manager": "ACCOUNTING_MANAGER",
  "/specialist": "SPECIALIST",
  "/customer": "CUSTOMER",
};

/**
 * The `role` claim, read without verifying the signature.
 *
 * That is deliberate and it is not the authorization: the backend re-checks the
 * role on every request, against the DATABASE and not just the claim (see
 * `requireRole`). This only decides which page to show, so a forged claim buys
 * an attacker a portal that then 403s on its first fetch — exactly where they
 * started. Verifying here would mean shipping the signing key to the proxy.
 */
function roleFromToken(token: string): Role | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const role = JSON.parse(json)?.role;
    return typeof role === "string" && role in landingByRole ? (role as Role) : null;
  } catch {
    return null;
  }
}

/** Roles we know a landing for — also the allowlist `roleFromToken` checks. */
const landingByRole: Record<Role, true> = {
  ADMIN: true,
  ACCOUNTING_MANAGER: true,
  SPECIALIST: true,
  CUSTOMER: true,
};

/** The portal a path sits in, or null for a shared/public route. */
function portalOwner(pathname: string): Role | null {
  for (const [prefix, role] of Object.entries(PORTAL_ROLE)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role;
  }
  return null;
}

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
   * working. It is therefore the ordinary state of any navigation made after
   * ~15 minutes of not clicking anything, and NOT on its own a signed-out one:
   * the refresh cookie behind it is good for 30 days.
   *
   * So an absent access cookie takes the refresh hop rather than ending the
   * session. Sending it straight to /login is what made the app appear to log
   * people out by itself — the session died at the access token's lifetime
   * with a month of refresh cookie left unspent, and only pages that happened
   * to poll (chat, every eight seconds) stayed alive, because their 401 went
   * through the client refresh in src/lib/http.ts. This gives every route what
   * chat already had.
   *
   * Refreshing HERE instead is the thing that cannot be done: proxy runs with
   * no shared state (it may be deployed to a CDN edge), and the backend
   * rotates the refresh token on every call — so two page loads racing would
   * each present the same token, the second would read as replay, and the
   * whole family gets revoked. The single-flight lock in src/lib/http.ts is
   * what makes that safe, and it only exists on the client. Hence a redirect
   * to a client route rather than a refresh in this file.
   *
   * `csrfToken` is the test for "is there a session to refresh at all". The
   * backend mints it alongside the refresh cookie, and unlike the HttpOnly
   * refresh cookie it can be read here. Without it this is a genuinely
   * signed-out visitor, and the hop would only fail and land on /login anyway.
   */
  if (!pathname.startsWith("/api")) {
    if (!accessToken) {
      const target = request.cookies.get(CSRF_COOKIE)
        ? `/login/refresh?next=${encodeURIComponent(pathname + search)}`
        : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }

    /**
     * Wrong portal for this role.
     *
     * Every portal layout loads role-scoped data in its first await — the
     * manager's reads `/accounting-manager/companies`, which is gated on
     * ACCOUNTING_MANAGER. Without this check a signed-in customer or admin
     * opening /manager renders the layout, takes the backend's 403, and gets
     * "Something went wrong" on EVERY route under it, with the message stripped
     * in a production build. Refusing at the door turns that into a redirect to
     * the portal they do have.
     *
     * A role we cannot read leaves the request alone rather than guessing: the
     * backend is still the one that decides, and locking someone out on an
     * unparsed claim would be a worse failure than the one being fixed.
     */
    const role = roleFromToken(accessToken);
    const owner = portalOwner(pathname);
    if (role && owner && owner !== role) {
      return NextResponse.redirect(
        new URL(landingPathForRole(role), request.url),
      );
    }

    return NextResponse.next();
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

  const response = NextResponse.rewrite(new URL(target), {
    request: { headers },
  });

  /*
   * NO BROWSER CACHE ON API RESPONSES, AND THAT IS THE CONSIDERED CHOICE.
   *
   * A positive `max-age` here looks like free speed and is not. The reads worth
   * caching are the expensive ones, and those happen in server components,
   * which never touch this header — they go through the data cache in
   * src/lib/http.ts instead. What DOES come through here is the traffic a cache
   * hurts: src/components/portal/chat-thread.tsx re-reads its thread every
   * eight seconds, and any max-age above that turns a live conversation into a
   * frozen one, invisibly, with no error to explain it.
   *
   * `no-store` also keeps authenticated JSON — invoices, client records, chat —
   * out of the browser's disk cache and out of any intermediary that would
   * otherwise treat an unlabelled 200 as fair game.
   *
   * Static assets are a different matter and already handled: Next fingerprints
   * everything under /_next/static and serves it immutable, which is the browser
   * caching that actually pays here.
   */
  response.headers.set("Cache-Control", "private, no-store");

  return response;
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
     * `login` covering /login/refresh is load-bearing, not incidental: that is
     * the route the guard above redirects to, and running the guard on it would
     * be an infinite redirect, since it is by definition reached with no access
     * cookie. Narrowing this alternative to an exact `login` breaks the hop.
     *
     * `.+` and not `.*` leaves `/` itself out: the portal picker is the page a
     * signed-out visitor is supposed to land on.
     */
    "/((?!api|_next|login|signup|otp_page_|forgot_password|accept-invitation|.*\\.).+)",
  ],
};
