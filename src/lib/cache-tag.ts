/**
 * The one tag every cached GET is filed under, and the one `revalidatePortal`
 * clears.
 *
 * Its own module because the writer is a `"use server"` file: everything a
 * server-action module exports must be an async function, so a shared constant
 * cannot live there, and importing that module from `http.ts` purely to read a
 * string would pull a server action into the client bundle.
 */
export const PORTAL_CACHE_TAG = "portal-data";

/**
 * How long a cached GET may be served before it is refetched.
 *
 * Thirty seconds is the window in which another user's change is invisible.
 * Your own is not affected — writes clear the tag outright.
 */
export const PORTAL_CACHE_SECONDS = 30;
