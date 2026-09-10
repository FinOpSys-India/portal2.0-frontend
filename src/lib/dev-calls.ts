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
 * DEVELOPMENT ONLY. `record` is a no-op in a production build, so nothing here
 * costs anything once deployed.
 *
 * ponytail: one module-level buffer, not per-request. Two pages rendering at
 * once in dev interleave their paths and the echo replays both — harmless when
 * one person is clicking. Move to AsyncLocalStorage if that ever misleads.
 */
const isDev = process.env.NODE_ENV === "development";

/** Bounded so a fan-out page (manager sweeps eight companies) cannot grow it without limit. */
const LIMIT = 60;

let calls: string[] = [];

export function record(path: string) {
  if (!isDev) return;
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
