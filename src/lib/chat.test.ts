/**
 * The chat contact mapping. Run: npx tsx src/lib/chat.test.ts
 *
 * `toContact` is the one part of this boundary that can be wrong without
 * erroring, and it was: chat's DTO spreads a PERSON into the row, where the key
 * is `id` and not the `userId` every directory in this app uses. Reading the
 * wrong one gave a list with no React keys, every row looking like the open
 * one, and a click asking the backend to open a conversation with nobody.
 *
 * The rows below are `chatDto.toContact`'s output, field for field.
 */
import assert from "node:assert/strict";

import { toContact } from "./chat";

const fresh = toContact({
  id: 13,
  firstName: "bookkeeping",
  lastName: "user",
  email: "testuser1_bookkeepingspecialist@finopsys.ai",
  roleLabel: "Bookkeeping",
  specializations: [],
  conversationId: null,
  lastMessageAt: null,
  lastMessage: null,
  unreadCount: 0,
});

assert.equal(fresh.userId, 13);
assert.equal(fresh.name, "bookkeeping user");

// A person who has never been messaged. THE ROW IS THE PERSON, not the thread —
// that is the whole difference from GET /chat/conversations, and the null id is
// what the screen branches on to start a first conversation.
assert.equal(fresh.conversationId, null);
assert.equal(fresh.lastMessage, "", "no thread means no last line to show");
assert.equal(fresh.lastMessageAt, "");
assert.equal(fresh.unread, 0);

const started = toContact({
  id: 21,
  userId: 21,
  firstName: "Owner",
  lastName: "One",
  email: "owner@example.com",
  roleLabel: null,
  specializations: [
    { specializationName: "Payroll" },
    { specializationName: null },
  ],
  conversationId: 7,
  lastMessageAt: "2026-08-19T09:00:00.000Z",
  lastMessage: {
    id: 91,
    conversationId: 7,
    body: "Thanks, that clears it up.",
    createdAt: "2026-08-19T09:00:00.000Z",
    sender: { firstName: "Owner", lastName: "One" },
    attachments: [],
    mine: false,
  },
  unreadCount: 2,
});

// Every id crossing this boundary is a STRING: they end up in URLs and React
// keys, and a number would compare unequal to the one the route carries.
assert.equal(started.conversationId, "7");
assert.equal(started.lastMessage, "Thanks, that clears it up.");
assert.equal(started.unread, 2);

// No `roleLabel` falls back to the specializations, blanks dropped — a column
// of names with no role beside them cannot be picked from with confidence.
assert.equal(started.roleLabel, "Payroll");

// Both rows answer the same shape. The manager's screen switches between the
// customer and specialist lists on one prop, so a divergence here would be a
// second render path.
assert.deepEqual(Object.keys(started).sort(), Object.keys(fresh).sort());

console.log("chat api: all checks passed");
