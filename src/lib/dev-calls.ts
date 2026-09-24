import { inflightCount } from "@/lib/http";

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
 * Whether the echo runs at all. LOCAL DEVELOPMENT ONLY, and no environment can
 * change that.
 *
 * This used to honour NEXT_PUBLIC_API_ECHO=1 so a deployed build could show its
 * server-side reads in DevTools, which was a deliberate disclosure while the
 * deployment was a test environment with nobody real on it. Turning it on is a
 * genuine one: the echo re-issues every backend GET a render made, from the
 * browser, so anyone with the tab open reads the internal API surface and the
 * FULL response body of each call — including the fields a page fetched and
 * chose not to show.
 *
 * The flag is deleted rather than left unset, so a stray variable on a project
 * nobody re-reads cannot turn it back on. `next dev` still prints every server
 * fetch with its full URL and status to the terminal — see `logging.fetches` in
 * next.config.ts — which is the half of this that never left the machine.
 */
export const ECHO_ENABLED = process.env.NODE_ENV === "development";

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
 * Drop anything a PREVIOUS request left behind, before this one records.
 *
 * The buffer is module-level, and on a warm serverless instance that is shared
 * by every request the instance handles. Seen on a real deployment: opening
 * `/company_select` replayed the admin pages' paths — `admin/company-accounts`,
 * `customers`, `specialists`, three `teammates` — in a customer's browser,
 * which answered them with four 403s and a 400. The page was reported as
 * calling endpoints it has nothing to do with, which is worse than showing
 * nothing.
 *
 * The root layout calls this before the page below it fetches anything, so a
 * render can no longer inherit the one before it.
 *
 * ponytail: this fixes SEQUENTIAL bleed, which is what navigation produces and
 * what was actually observed. Two requests rendering at the SAME time on one
 * instance still interleave — properly isolating that needs AsyncLocalStorage
 * wrapped around the request, which Next gives no hook for. Acceptable for a
 * development aid; it is the reason this must never be on for real users.
 */
export function reset(): void {
  if (!ECHO_ENABLED) return;
  calls = [];
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
 * WAITS FOR QUIET, NOT FOR A FIXED BEAT. This used to resolve after 700ms and
 * take whatever had landed, which silently lost every SECOND WAVE — the reads a
 * page cannot start until a first one returns. `/admin/companies` fetches its
 * rows and only then asks for each row's teammates, so the fan-out that is the
 * widest in the portal never appeared in the panel at all; `/admin/customers/
 * :email` hid its detail read the same way. A panel that under-reports is worse
 * than no panel, because it reads as proof the page is light.
 *
 * So it watches the in-flight counter in http.ts instead and resolves once
 * nothing has been in flight for three consecutive ticks. Three rather than one
 * because the gap between two waves is briefly zero, and a single zero reading
 * would stop exactly where the old timer did.
 *
 * ponytail: polling, with a floor and a ceiling. A render slower than the
 * ceiling still loses its tail, and a page that fetches on a timer longer than
 * the quiet window is not covered — counting waves properly would mean
 * instrumenting every await, which is a lot of machinery for a debugging aid.
 */
export function collect(): Promise<string[]> {
  return new Promise((resolve) => {
    const started = Date.now();
    let quiet = 0;

    const tick = setInterval(() => {
      quiet = inflightCount() === 0 ? quiet + 1 : 0;

      const settled = quiet >= QUIET_TICKS && Date.now() - started >= MIN_MS;
      if (settled || Date.now() - started >= MAX_MS) {
        clearInterval(tick);
        resolve(drain());
      }
    }, TICK_MS);
  });
}

const TICK_MS = 60;
/** Consecutive idle ticks before a render counts as finished. */
const QUIET_TICKS = 3;
/** Never resolve before this: the first wave may not have started yet. */
const MIN_MS = 250;
/** Never hold the response longer than this, however busy the render is. */
const MAX_MS = 8000;
