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
 * Absolute URL for a backend path (`/auth/login` -> `https://host/api/auth/login`).
 *
 * Refuses an unset origin rather than building a relative URL from it. Either
 * `BACKEND_URL` or `NEXT_PUBLIC_API_URL` names the server; with neither, every
 * call would otherwise die on `fetch` with "Failed to parse URL" — a message
 * that describes the symptom and never the missing variable.
 */
export function backendUrl(path: string): string {
  if (!ORIGIN) {
    throw new Error(
      "No backend configured. Set BACKEND_URL (or NEXT_PUBLIC_API_URL) to the API origin.",
    );
  }
  return `${ORIGIN.replace(/\/$/, "")}${PREFIX.replace(/\/$/, "")}${path}`;
}
