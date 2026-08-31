import assert from "node:assert/strict";
import test from "node:test";

import { fetchOrRetry, withSlot } from "@/lib/http";

/**
 * The cap exists to stop a per-company fan-out from starving the backend's
 * connection pool, so what is worth asserting is the ceiling and that every
 * caller still finishes — a limiter that quietly drops or reorders work would
 * cost a page its data rather than its speed.
 */
test("withSlot never runs more than the cap at once", async () => {
  let running = 0;
  let peak = 0;

  const results = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      withSlot(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return i;
      }),
    ),
  );

  assert.equal(peak, 8);
  assert.deepEqual(results, Array.from({ length: 30 }, (_, i) => i));
});

/** A rejection must free its slot, or one failure narrows the pool forever. */
test("withSlot releases the slot when the task throws", async () => {
  const failures = Array.from({ length: 10 }, () =>
    withSlot(async () => {
      throw new Error("boom");
    }).catch(() => "caught"),
  );
  assert.deepEqual(await Promise.all(failures), Array(10).fill("caught"));

  let ran = false;
  await withSlot(async () => {
    ran = true;
  });
  assert.equal(ran, true);
});

/**
 * A dead keep-alive socket — the backend restarted between renders — rejects
 * `fetch` before the request is ever answered. One retry rides that out; a write
 * does not get one, because a request that got no reply may still have landed.
 */
test("fetchOrRetry retries a read once, and never a write", async () => {
  const original = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    const res = await fetchOrRetry("http://backend/x", {}, true);
    assert.equal(res.status, 200);
    assert.equal(calls, 2, "the read is attempted twice");

    calls = 0;
    await assert.rejects(
      fetchOrRetry("http://backend/x", { method: "POST" }, false),
      /fetch failed/,
    );
    assert.equal(calls, 1, "the write is attempted once");
  } finally {
    globalThis.fetch = original;
  }
});
