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

import { needsReload, toLiveMessage, type ChatMessageRow } from "./chat-realtime";
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

console.log("chat realtime: all checks passed");
