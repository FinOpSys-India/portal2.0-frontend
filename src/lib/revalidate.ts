"use server";

import { updateTag } from "next/cache";

import { PORTAL_CACHE_TAG } from "@/lib/cache-tag";

/**
 * Drop the cached GET responses in src/lib/http.ts.
 *
 * Every write in this app is a client fetch through the proxy followed by
 * `router.refresh()` — there are no server actions doing the writing, so the
 * Next server never sees the mutation and its data cache would happily serve
 * the pre-write rows to the refresh that was meant to show them. Waiting out a
 * thirty-second TTL is tolerable for somebody else's change; it is not
 * tolerable for your own, which is the one you are staring at the screen for.
 *
 * This is the whole reason the cache is tagged. `request` calls it from the
 * browser after any successful non-GET, which is the one place every write
 * already passes through.
 *
 * `updateTag`, NOT `revalidateTag`. The two differ on exactly the case this
 * exists for: `revalidateTag(tag, "max")` marks the entry stale and serves the
 * stale copy while it refetches, which would show the user the row as it was
 * before the edit they just made. `updateTag` expires it outright so the next
 * read blocks for fresh data — the docs call this read-your-own-writes, and it
 * is only callable from a Server Action, which is why this file is one.
 */
export async function revalidatePortal(): Promise<void> {
  updateTag(PORTAL_CACHE_TAG);
}
