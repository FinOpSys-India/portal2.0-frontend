/**
 * Which backend GETs the last server render made — so the browser can replay
 * them and they show up in the Network tab.
 *
 * Every portal page is a server component, so its data fetches happen node-to-
 * node during SSR and are invisible to DevTools by construction. This records
 * the paths; src/components/dev/network-echo.tsx re-issues each one from the
 * browser through the proxy, which is what puts a real request, status and body
 * in the Network panel.
 *
 * OFF BY DEFAULT ON A DEPLOY. `record` is a no-op unless the echo is enabled,
 * so nothing here costs anything on a build that has not asked for it.
 *
 * ponytail: one module-level buffer, not per-request. Two pages rendering at
 * once interleave their paths and the echo replays both — harmless when one
 * person is clicking. Move to AsyncLocalStorage if that ever misleads.
 *
 * ponytail: in-process, so on a deployed build it only reaches the browser when
 * the render and the /dev-echo request land on the same serverless instance.
 * Usually they do; when they do not, that page's reads are missing from the
 * panel and a refresh fetches them. A store the instances share is the upgrade,
 * and it is not worth one for a testing aid.
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
