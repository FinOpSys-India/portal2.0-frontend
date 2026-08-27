/**
 * Where the backend lives, and what the frontend calls it by.
 *
 * Two names for one server, deliberately:
 *
 *   `backendUrl(path)`  the absolute origin. Used by the proxy and by server
 *                       components, which have no notion of "this site" to
 *                       resolve a relative URL against.
 *   `/api/<path>`       the same-origin path the browser uses. It reaches the
 *                       backend through src/proxy.ts.
 *
 * BACKEND_API_PREFIX exists because the backend's own default disagrees with
 * its README: `src/config/index.js` reads `API_PREFIX || '/'`, so a deployment
 * that never set the variable serves `/auth/login`, not `/api/auth/login`.
 * Rather than guess, this is configurable and defaults to the documented `/api`.
 */

/** Set by the frontend after sign-in; read by the proxy. Not HttpOnly — see below. */
export const ACCESS_TOKEN_COOKIE = "accessToken";

/**
 * The backend's own CSRF cookie, minted alongside the refresh cookie. The
 * client reads it and echoes it as a header on /auth/refresh and /auth/logout.
 */
export const CSRF_COOKIE = "csrfToken";
export const CSRF_HEADER = "x-csrf-token";

const ORIGIN = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
const PREFIX = process.env.BACKEND_API_PREFIX ?? "/api";

/**
 * True once a backend is configured. Until then the boundaries answer from their
 * mocks.
 *
 * CONFIGURE THIS AS `NEXT_PUBLIC_API_URL`, NOT `BACKEND_URL`. This module is
 * imported by client components — every auth form goes through `api.login` /
 * `api.verifyOtp` — and Next inlines only `NEXT_PUBLIC_*` into the browser
 * bundle. Under the server-only name the server saw a backend and the browser
 * did not, so login resolved against its fixture, redirected to the OTP screen
 * with a made-up challenge id, and the request that sends the email was never
 * made. It fails as a working app that emails nobody, which is why the switch
 * asserts rather than trusting the deployment to have used the right name.
 *
 * `PREFIX` needs no such treatment: `backendUrl` is called only by the proxy and
 * by server components. The browser addresses the backend as `/api/<path>` and
 * never reads it.
 */
export const LIVE = Boolean(ORIGIN);

if (process.env.BACKEND_URL && !process.env.NEXT_PUBLIC_API_URL) {
  // Server-side only — the browser cannot see BACKEND_URL, which is the bug.
  console.warn(
    "[backend] BACKEND_URL is set but NEXT_PUBLIC_API_URL is not: the browser " +
      "will run every client boundary against its mock (no login, no OTP email). " +
      "Set NEXT_PUBLIC_API_URL to the same origin.",
  );
}

/** Absolute URL for a backend path (`/auth/login` -> `https://host/api/auth/login`). */
export function backendUrl(path: string): string {
  return `${ORIGIN.replace(/\/$/, "")}${PREFIX.replace(/\/$/, "")}${path}`;
}
