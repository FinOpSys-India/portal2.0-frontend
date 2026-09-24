/**
 * The call recorder: dedupe, bound, hand the list over exactly once — and stay
 * silent on a deployed build that has not asked for the echo.
 *
 * The echo replays whatever `drain` returns, so a duplicate here is a duplicate
 * request in the Network panel, and a list that is never cleared is one page's
 * calls replayed on every page after it.
 *
 * The off case is the one with a consequence outside the panel: with the flag
 * unset, a production build must record nothing, because `collect` streams the
 * same buffer to the browser and those paths are not for the public.
 */
import assert from "node:assert/strict";

async function main() {
  // Set before the import: the module reads the environment once at load, and
  // `record` is deliberately a no-op unless the echo is enabled — which is what
  // the rest of the suite runs as.
  //
  // Written through a mutable view because Next's ambient types declare
  // `NODE_ENV` readonly, which is right for app code and wrong for the one
  // place that has to stage the value the module under test reads.
  (process.env as Record<string, string>).NODE_ENV = "development";
  const { collect, drain, record } = await import("./dev-calls");

  /* ------------------------------------------------------------ dedupe --- */

  record("/accounting-manager/companies");
  record("/accounting-manager/companies");
  record("/auth/me");

  assert.deepEqual(drain(), ["/accounting-manager/companies", "/auth/me"]);

  /* -------------------------------------------- drain clears, once only --- */

  assert.deepEqual(drain(), [], "a second read must not replay the first list");

  /* ------------------------------------------------------------- bound --- */

  for (let i = 0; i < 100; i += 1) record(`/projects/${i}`);
  const overflowed = drain();

  assert.equal(overflowed.length, 60, "buffer stays bounded");
  assert.equal(overflowed[0], "/projects/40", "oldest paths drop first");
  assert.equal(overflowed.at(-1), "/projects/99");

  /* ------------------------------------------------ off unless enabled --- */

  // A second load of the same module, with production staged: the `?` suffix is
  // what gets past the module cache, since the flag is read at load time and
  // cannot be re-read from the copy already imported above. Built as an
  // expression so TypeScript reads it as a dynamic specifier and does not try
  // to resolve `./dev-calls?production` as a file on disk.
  const reload = (tag: string) =>
    import(`./dev-calls?${tag}`) as Promise<typeof import("./dev-calls")>;

  (process.env as Record<string, string>).NODE_ENV = "production";
  const off = await reload("production");

  assert.equal(off.ECHO_ENABLED, false, "a production build stays off");
  off.record("/auth/me");
  assert.deepEqual(off.drain(), [], "nothing is recorded while it is off");

  /* ---------------------------------------- no environment can opt in --- */

  // The point of the assertion: NEXT_PUBLIC_API_ECHO used to turn this on for a
  // deployed build, and the echo streams every recorded path to the browser to
  // be replayed with its real response body. The flag is gone, so a variable
  // still sitting on some project — or one added back by hand — must not be
  // able to re-open that.
  process.env.NEXT_PUBLIC_API_ECHO = "1";
  const flagged = await reload("production-flagged");

  assert.equal(flagged.ECHO_ENABLED, false, "no env var re-enables the echo");
  flagged.record("/auth/me");
  assert.deepEqual(flagged.drain(), [], "and it records nothing either way");
  assert.deepEqual(await flagged.collect(), [], "so it streams nothing down");
  delete process.env.NEXT_PUBLIC_API_ECHO;

  /* ------------------------------------------------ collect hands over --- */

  // The layout renders before the page's fetches run, so `collect` is a promise
  // that reads the buffer late. Recording AFTER the call is the whole point —
  // if it drained eagerly the panel would be empty, which is the bug this
  // replaced. Back on the development copy, the only one that records.
  const collected = collect();
  record("/projects?page=1");
  assert.deepEqual(await collected, ["/projects?page=1"]);
  assert.deepEqual(drain(), [], "collect leaves the buffer clear");

  console.log("dev calls: all checks passed");
}

main();
