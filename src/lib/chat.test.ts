/**
 * The chat boundary's mock contract. Run: npx tsx src/lib/chat.test.ts
 *
 * The point of these is the CONTACT list, which is the shape the inbox was
 * getting wrong: it rendered conversations, so a person with no thread yet was
 * missing from the screen and no first message could ever be sent to them.
 */
import assert from "node:assert/strict";

import { chatApi, toContact } from "./chat";

async function main() {
  const customers = await chatApi.contacts("18", "customer");

  // THE PERSON IS THE ROW. Everyone on the company appears, whether or not a
  // thread exists — that is the whole difference from GET /chat/conversations.
  assert.ok(customers.length >= 2, "the list is people, not threads");

  const started = customers.find((c) => c.conversationId !== null);
  const fresh = customers.find((c) => c.conversationId === null);

  assert.ok(started, "someone already messaged");
  assert.ok(
    fresh,
    "someone never messaged — the case a conversations-only list cannot show",
  );

  // A never-messaged row must still be openable: it carries the person's id,
  // which is what POST /chat/conversations is called with.
  assert.ok(Number.isFinite(fresh.userId));
  assert.equal(fresh.lastMessage, "", "no thread means no last line to show");
  assert.equal(fresh.unread, 0);

  // A started thread names its conversation as a STRING — every id crossing
  // this boundary is one, because they end up in URLs and React keys.
  assert.equal(typeof started.conversationId, "string");

  // Both sections answer the same shape. The manager's screen switches between
  // them on one prop, so a divergence here would be a second render path.
  const specialists = await chatApi.contacts("18", "specialist");
  assert.deepEqual(
    Object.keys(specialists[0]).sort(),
    Object.keys(customers[0]).sort(),
  );

  // Every contact is labelled. A column of names with no role beside them
  // cannot be picked from with any confidence.
  for (const contact of [...customers, ...specialists]) {
    assert.ok(contact.name, "a contact always has a name");
    assert.equal(typeof contact.roleLabel, "string");
  }

  // The read receipt answers with the REMAINING unread count, which is what the
  // badge is set from — not the number it just cleared.
  assert.equal(typeof (await chatApi.markRead("c-1")), "number");
  assert.equal(typeof (await chatApi.unreadCount("18")), "number");

  /*
   * THE LIVE ROW, not the fixture. A contact carries `id` — chat's DTO spreads a
   * PERSON into the row, where the key is not the `userId` every directory in
   * this app uses — and reading the wrong one is invisible in mock mode: it is
   * the fixtures that answer, and they are already the mapped shape. The row
   * below is `chatDto.toContact`'s output, field for field.
   */
  const row = toContact({
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

  // Without it the list has no keys, every row looks like the open one, and
  // opening a thread asks the backend to start a conversation with nobody.
  assert.equal(row.userId, 13);
  assert.equal(row.name, "bookkeeping user");
  assert.equal(row.conversationId, null);

  console.log("chat api: all checks passed");
}

main();
