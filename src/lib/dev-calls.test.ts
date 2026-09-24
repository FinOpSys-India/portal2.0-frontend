/**
 * The call recorder: dedupe, bound, hand the list over exactly once — and stay
 * silent on a deployed build that has not asked for the echo.
 *
 * The echo replays whatever `drain` returns, so a duplicate here is a duplicate
 * request in the Network panel, and a list that is never cleared is one page's
 * calls replayed on every page after it.
 *
 * The off cases are the ones with a consequence outside the panel, because
 * `collect` streams the same buffer to the browser and those paths are not for
 * the public. Two are checked: a plain production build, and a production build
 * that HAS the flag set — which must still stay off, since the flag is meant
 * for preview and a variable can be retargeted by hand.
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

  /* ------------------------------------- production cannot opt in ------ */

  // THE ASSERTION THAT MATTERS. NEXT_PUBLIC_API_ECHO turns the echo on for a
  // deployed build, and the echo streams every recorded path to the browser to
  // be replayed with its real response body. It is set on Preview alone — but a
  // variable is one click from being retargeted, so the build must refuse
  // production even when the flag is present.
  process.env.NEXT_PUBLIC_API_ECHO = "1";
  process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
  const flagged = await reload("production-flagged");

  assert.equal(
    flagged.ECHO_ENABLED,
    false,
    "the flag must not open the echo on a production build",
  );
  flagged.record("/auth/me");
  assert.deepEqual(flagged.drain(), [], "and it records nothing either way");
  assert.deepEqual(await flagged.collect(), [], "so it streams nothing down");

  /* ------------------------------------------- preview may opt in ------- */

  // The case the flag exists for: the backend developer reads the API off a
  // preview deploy, which talks to the same backend production does.
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  const preview = await reload("preview-flagged");

  assert.equal(preview.ECHO_ENABLED, true, "preview opts in with the flag");
  preview.record("/users/me");
  assert.deepEqual(preview.drain(), ["/users/me"], "and it records there");

  // Preview WITHOUT the flag stays off: opting in is the deliberate act, and
  // every other preview deploy must be as quiet as production.
  delete process.env.NEXT_PUBLIC_API_ECHO;
  const quiet = await reload("preview-unflagged");

  assert.equal(quiet.ECHO_ENABLED, false, "preview stays off without the flag");

  delete process.env.NEXT_PUBLIC_VERCEL_ENV;

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
