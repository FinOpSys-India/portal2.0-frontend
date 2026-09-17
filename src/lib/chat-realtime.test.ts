/**
 * The live-message mapper. Run: npx tsx src/lib/chat-realtime.test.ts
 *
 * There are now TWO ways a message reaches the screen — loaded over REST, and
 * pushed down the socket — and they arrive in different shapes from different
 * places. That is exactly where the two can drift apart, so the socket's
 * translation is pinned here against rows shaped as `chat_messages` actually
 * stores them (see Portal-backend/db/schema/20_add_chat.sql).
 */
import assert from "node:assert/strict";

import {
  keepTombstones,
  mergeTombstones,
  needsReload,
  pollWhileOffline,
  toLiveMessage,
  type ChatMessageRow,
} from "./chat-realtime";
import { toChatMessage } from "./portal";

const ME = 47;
const THEM = 12;

const row: ChatMessageRow = {
  // BIGSERIAL. It arrives as a number and every id on this side is a string,
  // because they end up in React keys and URLs.
  id: 9007,
  conversation_id: 3,
  sender_user_id: THEM,
  body: "Payroll register is ready.",
  created_at: "2026-08-20T10:00:00.000Z",
  deleted_at: null,
};

/* ------------------------------------------------------------- the mapper -- */

const incoming = toLiveMessage(row, ME);
assert.equal(incoming.id, "9007");
assert.equal(incoming.body, "Payroll register is ready.");
assert.equal(incoming.sentAt, "2026-08-20T10:00:00.000Z");

// `mine` DOES NOT EXIST ON THE ROW. The REST payload carries it because the
// server knows who asked; the socket sends the table, so it is derived from the
// viewer the token names. Getting this backwards puts every bubble on the wrong
// side of the window.
assert.equal(incoming.mine, false, "sent by the other side");
assert.equal(
  toLiveMessage({ ...row, sender_user_id: ME }, ME).mine,
  true,
  "sent by the viewer",
);

/* ------------------------------------------------ the two shapes must agree -- */

// The same message, one arriving over REST and one over the socket, must render
// identically apart from attachments — otherwise a thread looks different
// depending on whether you were watching when it arrived.
const overRest = toChatMessage({
  id: 9007,
  conversationId: 3,
  sender: { firstName: "Alex", lastName: "Morgan" },
  body: "Payroll register is ready.",
  attachments: [],
  createdAt: "2026-08-20T10:00:00.000Z",
  mine: false,
});
assert.deepEqual(incoming, overRest, "live and loaded must agree");

/* ----------------------------------------------------- the attachment hole -- */

// `chat_attachments` is not in the realtime publication, so a file-only message
// arrives with a null body and no way to learn the files exist. Rendering it
// would produce an empty bubble — the caller refetches instead.
assert.equal(needsReload({ ...row, body: null }), true);
assert.equal(needsReload(row), false);

// And it never invents one: attachments are always empty off the socket.
assert.deepEqual(toLiveMessage(row, ME).attachments, []);

/* ------------------------------------------------------------ soft delete -- */

// A delete stamps `deleted_at`, so it crosses the wire as an UPDATE carrying
// the whole row — never as a DELETE event. A subscriber watching only for
// deletes would never see one.
assert.ok(row.deleted_at === null, "a live message is not deleted");
assert.ok(
  ({ ...row, deleted_at: "2026-08-20T11:00:00.000Z" } as ChatMessageRow)
    .deleted_at,
  "a removed one carries the stamp the UPDATE is recognised by",
);

/* --------------------------------------------------------------- ordering -- */

// The thread sorts on `sentAt` as an ISO string. That only works because the
// column is UTC with a fixed offset — a local-time string would sort wrong
// across a timezone change.
const times = [
  "2026-08-20T09:00:00.000Z",
  "2026-08-20T10:00:00.000Z",
  "2026-08-21T08:00:00.000Z",
];
assert.deepEqual([...times].sort((a, b) => a.localeCompare(b)), times);

/* ------------------------------------------------------- keeping tombstones -- */

// A thread as this tab holds it, oldest first — the order the loader returns.
const at = (n: number) => `2026-08-20T1${n}:00:00.000Z`;
const msg = (id: string, n: number) => ({
  id,
  mine: false,
  body: `m${id}`,
  sentAt: at(n),
  attachments: [],
  reactions: [],
  deleted: false,
});

const held = [msg("1", 0), msg("2", 1), msg("3", 2), msg("4", 3)];

// THE BUG. The re-read cannot return a deleted row, so "2" is simply missing
// from the page. Without this it vanished from the screen; with it the bubble
// stays and says it was deleted.
const afterDelete = keepTombstones([held[0], held[2], held[3]], held);
assert.deepEqual(
  afterDelete.map((m) => m.id),
  ["1", "2", "3", "4"],
  "the deleted message keeps its place",
);
const stone = afterDelete[1];
assert.equal(stone.deleted, true);
assert.equal(stone.body, "", "and keeps nothing it said");
assert.deepEqual(stone.attachments, []);
assert.deepEqual(stone.reactions, []);

// PAGED OUT, NOT DELETED. The thread reads a fixed window, so the oldest row
// falls off the top as new ones arrive. Absent and OLDER than the page's oldest
// is the one case absence does not mean deletion.
assert.deepEqual(
  keepTombstones([held[1], held[2], held[3], msg("5", 4)], held).map((m) => m.id),
  ["2", "3", "4", "5"],
  "a row that paged out is dropped, not tombstoned",
);

// THE POLL RACE. A message that arrived over the socket after the page was
// fetched is absent from it and NEWER than everything in it. Marking that one
// deleted would tombstone a message nobody touched.
const withLive = [...held, msg("9", 4)];
assert.deepEqual(
  keepTombstones(held, withLive).map((m) => m.id),
  ["1", "2", "3", "4"],
  "a message the page has not caught up to is left alone",
);
assert.ok(
  !keepTombstones(held, withLive).some((m) => m.deleted),
  "and is not turned into a tombstone",
);

// Nothing held, or an empty page: the read stands on its own.
assert.deepEqual(keepTombstones(held, null), held);
assert.deepEqual(keepTombstones([], held), []);

// Already a tombstone, still absent from the page — it stays one rather than
// flickering back into a bubble.
const twice = keepTombstones([held[0], held[2], held[3]], afterDelete);
assert.equal(twice[1].deleted, true, "a tombstone survives the next read too");

/* ------------------------------------------------- tombstones, after a reload -- */

// The page the API returns holds no deleted rows at all, so these come from the
// database read. Unlike `keepTombstones` nothing here is inferred — the rows say
// they are deleted — and that is why the upper bound is gone.
const page = [msg("2", 2), msg("3", 3)];
const buried = (id: string, at: number) => ({
  ...msg(id, at),
  deleted: true,
  body: "",
});

// THE NEWEST MESSAGE IS THE COMMON ONE TO DELETE. Bounding by the newest live
// row — which is what the poll's merge has to do — would drop exactly that one.
assert.deepEqual(
  mergeTombstones(page, [buried("4", 4)]).map((m) => m.id),
  ["2", "3", "4"],
  "a tombstone newer than every live row is kept",
);
assert.equal(
  mergeTombstones(page, [buried("4", 4)])[2].deleted,
  true,
  "and it renders as a tombstone",
);

// In the middle, in its own place rather than appended.
assert.deepEqual(
  mergeTombstones([msg("1", 1), msg("4", 4)], [buried("2", 2)]).map((m) => m.id),
  ["1", "2", "4"],
  "a tombstone sorts back into the thread by its own timestamp",
);

// Older than the page: it belongs to a page this thread has not loaded
// (`limit=50`), and hanging it under the last fifty would put it in the wrong
// place entirely.
assert.deepEqual(
  mergeTombstones(page, [buried("1", 1)]).map((m) => m.id),
  ["2", "3"],
  "a tombstone older than the loaded page is left for that page",
);

// A thread where everything was deleted still has to show that something was
// said — there is no oldest live row to bound against.
assert.deepEqual(
  mergeTombstones([], [buried("1", 1), buried("2", 2)]).map((m) => m.id),
  ["1", "2"],
  "an all-deleted thread draws its tombstones",
);

// The row is already on screen: the fetch must not double it.
assert.deepEqual(
  mergeTombstones(page, [buried("3", 3)]).map((m) => m.id),
  ["2", "3"],
  "a tombstone already in the page is not appended twice",
);
assert.deepEqual(mergeTombstones(page, []), page, "nothing deleted, nothing to do");

/* ------------------------------------------------------- the poll fallback -- */

// Timers, so the last checks run inside an async main — this file compiles to
// CJS, which has no top-level await.
void (async () => {
  // A channel that opens and then errors used to read as a working one, so the
  // thread went quiet until the page was reloaded. The gate is what makes the
  // poll cover that, and it has to stop again when the socket comes back — two
  // readers of the same thread is the bug on the other side of this one.
  const ticks: string[] = [];
  const gate = pollWhileOffline(() => ticks.push("reload"), 5);

  // Healthy from the start: nothing to do, and no timer.
  gate.onHealth(true);
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(ticks, [], "a delivering socket is never polled behind");

  // CHANNEL_ERROR. Twice, because a flapping channel reports it more than once
  // and a second timer would double every read.
  gate.onHealth(false);
  gate.onHealth(false);
  await new Promise((r) => setTimeout(r, 30));
  const whileDown = ticks.length;
  assert.ok(whileDown > 0, "a dead channel falls back to polling");

  // SUBSCRIBED again: the timer stops, and ONE read closes the gap Realtime
  // cannot replay.
  gate.onHealth(true);
  const atRecovery = ticks.length;
  assert.equal(atRecovery, whileDown + 1, "recovery re-reads the thread once");
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ticks.length, atRecovery, "and the poll is gone");

  // Unmounted while down: nothing keeps running.
  gate.onHealth(false);
  gate.stop();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ticks.length, atRecovery, "stop() ends the poll for good");

  console.log("chat realtime: all checks passed");
})();
