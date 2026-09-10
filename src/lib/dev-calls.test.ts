/**
 * The dev call recorder: dedupe, bound, and hand the list over exactly once.
 *
 * The echo replays whatever `drain` returns, so a duplicate here is a duplicate
 * request in the Network panel, and a list that is never cleared is one page's
 * calls replayed on every page after it.
 */
import assert from "node:assert/strict";

async function main() {
  // Set before the import: the module reads NODE_ENV once at load, and `record`
  // is deliberately a no-op outside development — which is what the rest of the
  // suite runs as.
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

  console.log("dev calls: all checks passed");
}

main();
