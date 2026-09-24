/**
 * `openThread` check. Run: npx tsx --test src/lib/chat-thread.test.ts
 *
 * The one branch worth pinning: a company with no accounting manager answers
 * 409 NO_ACCOUNTING_MANAGER, and that must come back as an empty thread rather
 * than throwing — an uncaught throw here is the whole chat page. Every other
 * failure must still propagate, or a broken backend reads as "not staffed yet".
 */
import assert from "node:assert/strict";
import test from "node:test";

// The fetch layer is isomorphic and picks its branch off `window`. Standing one
// up puts it on the browser path, which reads the token from `document.cookie`
// instead of `next/headers` — the latter needs a request scope no test has.
Object.assign(globalThis, { window: {}, document: { cookie: "" } });

// Imported lazily for the same reason: the flag above is read once, when the
// fetch layer's module first loads.
const load = async () => (await import("@/lib/manager")).openThread;

function answer(status: number, body: unknown): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof globalThis.fetch;
}

const real = globalThis.fetch;

test("a company with no accounting manager gets an empty thread", async () => {
  globalThis.fetch = answer(409, {
    success: false,
    error: {
      code: "NO_ACCOUNTING_MANAGER",
      message: "This company has no accounting manager yet.",
    },
  });
  try {
    assert.deepEqual(await (await load())("3"), {
      id: null,
      contact: "",
      contactAvatarUrl: null,
      unread: 0,
    });
  } finally {
    globalThis.fetch = real;
  }
});

test("any other failure still throws", async () => {
  globalThis.fetch = answer(500, {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
  try {
    await assert.rejects((await load())("3"));
  } finally {
    globalThis.fetch = real;
  }
});
