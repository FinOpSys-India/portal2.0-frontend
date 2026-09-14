/**
 * Which backend GETs the last server render made — so the browser can replay
 * them and they show up in the Network tab.
 *
 * Every portal page is a server component, so its data fetches happen node-to-
 * node during SSR and are invisible to DevTools by construction. This records
 * the paths; the root layout hands them to src/components/dev/network-echo.tsx
 * IN THE SAME RESPONSE, and that client component re-issues each one from the
 * browser through the proxy — which is what puts a real request, status and
 * body in the Network panel.
 *
 * THE LIST TRAVELS WITH THE PAGE, AND IT HAS TO. This used to be a buffer that
 * a separate route handler read back over fetch, and on Vercel that could never
 * work: routes are built into separate functions, so the page render and the
 * handler run in different processes with different memory. The handler always
 * answered with an empty list, silently, and the echo replayed nothing. Locally
 * it is all one process, which is exactly why the bug did not show there.
 *
 * OFF BY DEFAULT ON A DEPLOY. `record` is a no-op unless the echo is enabled,
 * so nothing here costs anything on a build that has not asked for it.
 *
 * ponytail: one module-level buffer, not per-request. Two pages rendering at
 * once interleave their paths and the echo replays both — harmless when one
 * person is clicking. Move to AsyncLocalStorage if that ever misleads.
 *
 * ponytail: `collect` waits a fixed beat rather than knowing when the render's
 * fetches are done — there is no signal for "this tree has finished awaiting".
 * A page slower than the delay loses its last few rows. Counting in-flight
 * requests in src/lib/http.ts and resolving at zero is the upgrade, if that
 * ever bites.
 */
/**
 * Whether the echo runs at all.
 *
 * Always on locally. On a deployed build it waits for NEXT_PUBLIC_API_ECHO=1,
 * which is how live testing gets to see the server-side reads DevTools cannot
 * otherwise show. Next inlines NEXT_PUBLIC_* at build time, so setting or
 * clearing the variable takes a redeploy, not a restart.
 *
 * ENABLING IT ON A DEPLOY IS A DISCLOSURE: anyone who opens DevTools on that
 * build sees the internal API paths and the real response bodies. Clear the
 * variable before the site is customer-facing.
 */
export const ECHO_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_API_ECHO === "1";

/** Bounded so a fan-out page (manager sweeps eight companies) cannot grow it without limit. */
const LIMIT = 60;

let calls: string[] = [];

export function record(path: string) {
  if (!ECHO_ENABLED) return;
  // Deduped: `overCompanies` asks for the same shape per company and the data
  // cache answers most of them, so an echo per duplicate is noise.
  if (!calls.includes(path)) calls.push(path);
  if (calls.length > LIMIT) calls.shift();
}

/** Read and clear — the next render starts a fresh list. */
export function drain(): string[] {
  const out = calls;
  calls = [];
  return out;
}

/**
 * The paths this render collected, as a promise the layout hands to the client.
 *
 * WHY A PROMISE AND NOT A VALUE. The root layout renders before the page below
 * it, so at that moment the buffer holds nothing — the fetches being recorded
 * have not run yet. React streams a promise prop to a client component whenever
 * it resolves, so waiting inside one is what lets the layout ship a list it
 * could not possibly have had when it rendered.
 *
 * The delay is the crude part: there is no "the tree is done awaiting" signal
 * to hang this on, so it waits a beat that comfortably outlasts a normal render
 * and reads the buffer then. The response stays open that much longer, which is
 * a price only a build with the echo turned on pays.
 */
export function collect(): Promise<string[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(drain()), SETTLE_MS);
  });
}

/** Long enough for a page's reads to land, short enough not to stall the tab. */
const SETTLE_MS = 700;
