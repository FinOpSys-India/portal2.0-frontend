/**
 * The call recorder: dedupe, bound, hand the list over exactly once — and stay
 * silent on a deployed build that has not asked for the echo.
 *
 * The echo replays whatever `drain` returns, so a duplicate here is a duplicate
 * request in the Network panel, and a list that is never cleared is one page's
 * calls replayed on every page after it.
 *
 * The off case is the one with a consequence outside the panel: with the flag
 * unset, a production build must record nothing, because /dev-echo answers
 * from the same buffer and the paths it would name are not for the public.
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
  const { drain, record } = await import("./dev-calls");

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
  delete process.env.NEXT_PUBLIC_API_ECHO;
  const off = await reload("production");

  assert.equal(off.ECHO_ENABLED, false, "a plain production build stays off");
  off.record("/auth/me");
  assert.deepEqual(off.drain(), [], "nothing is recorded while it is off");

  /* --------------------------------------------- opted in on a deploy --- */

  process.env.NEXT_PUBLIC_API_ECHO = "1";
  const on = await reload("production-opted-in");

  assert.equal(on.ECHO_ENABLED, true, "NEXT_PUBLIC_API_ECHO=1 turns it on");
  on.record("/auth/me");
  assert.deepEqual(on.drain(), ["/auth/me"]);

  console.log("dev calls: all checks passed");
}

main();
