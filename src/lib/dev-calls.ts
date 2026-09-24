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
 * NEVER ON A DEPLOY. `record` is a no-op unless the echo is enabled, and it is
 * only ever enabled by `next dev` — so none of this costs, or discloses,
 * anything on a built deployment.
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
 * Whether the echo runs at all: local development, or a PREVIEW deploy that
 * asks for it. Production cannot have it, and not by convention — see below.
 *
 * Turning this on is a real disclosure, which is why it is spelled out rather
 * than left to whoever reads the variable name. The echo re-issues every
 * backend GET a render made, from the browser, so anyone with the tab open
 * reads the internal API surface and the FULL response body of each call —
 * including the fields a page fetched and chose NOT to show. Each replay
 * carries the viewer's own bearer token, so nobody sees another account's
 * data; what they see is their own, unredacted by the UI.
 *
 * It also DOUBLES a page's backend reads, which is not free on the sweeps: a
 * manager or specialist page already fetches once per company, and the echo
 * makes that twice, against a ten-connection pool.
 *
 * PRODUCTION IS EXCLUDED BY THE BUILD, NOT BY REMEMBERING. The second clause
 * reads `NEXT_PUBLIC_VERCEL_ENV`, which Vercel inlines at build time — so
 * setting NEXT_PUBLIC_API_ECHO=1 on Production, by hand or by accident, still
 * produces a build with the echo off. The variable is set on Preview alone,
 * and that is the belt; this is the braces, because the variable is one click
 * from being retargeted and this file is not.
 *
 * Preview and Production read the same backend, so a preview deploy shows the
 * same API behaviour that production would — which is what makes excluding
 * production cost nothing.
 *
 * `next dev` also prints every server fetch with its full URL and status to the
 * terminal — see `logging.fetches` in next.config.ts — which is the half of
 * this that never leaves the machine.
 */
export const ECHO_ENABLED =
  process.env.NODE_ENV === "development" ||
  (process.env.NEXT_PUBLIC_API_ECHO === "1" &&
    process.env.NEXT_PUBLIC_VERCEL_ENV !== "production");

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
