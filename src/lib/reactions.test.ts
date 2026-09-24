/**
 * The optimistic reaction state. Run: npx tsx src/lib/reactions.test.ts
 *
 * `setLocal` and `clearLocal` are the one piece of reaction handling that is
 * real logic rather than markup: a chip has to appear, grow, shrink, MOVE and
 * disappear from the same click, before the server has answered.
 *
 * The case that bites is the move. `PUT /chat/messages/:id/reaction` sets the
 * viewer's reaction rather than adding one, so picking a second emoji has to
 * take the first one back — painting both, as a toggle would, shows a state the
 * server contradicts a moment later.
 */
import assert from "node:assert/strict";

import {
  clearLocal,
  COMPOSER_EMOJI,
  REACTIONS,
  reactionEmoji,
  reactionName,
  setLocal,
  toMessageReaction,
} from "./reactions";

/* ---------------------------------------------------------------- naming -- */

/* The wire value is the name, and it round-trips. */
assert.equal(reactionName("❤️"), "love");
assert.equal(reactionEmoji("love"), "❤️");
for (const { emoji, name } of REACTIONS) {
  assert.equal(reactionName(emoji), name);
  assert.equal(reactionEmoji(name), emoji);
}

/* An emoji outside the six has no wire name — chat.ts refuses to send it
   rather than letting the backend answer 400 about a field it never sees. */
assert.equal(reactionName("🥑"), null);

/* A name the backend grew before this list did still draws SOMETHING. A blank
   chip cannot be read or explained; the raw word can. */
assert.equal(reactionEmoji("shipped"), "shipped");

/* ------------------------------------------------------------ server rows -- */

/* The API's shape: a name, resolved to the character the chip draws. */
assert.deepEqual(toMessageReaction({ reaction: "like", count: 2, mine: true }), {
  emoji: "👍",
  count: 2,
  mine: true,
});

/* The older shape, still accepted, so a deployment mid-rollout renders. */
assert.deepEqual(toMessageReaction({ emoji: "👍", count: 1, mine: false }), {
  emoji: "👍",
  count: 1,
  mine: false,
});

/* A row that exists describes at least one reactor: count defaults to 1, never
   to a chip reading "0". */
assert.deepEqual(toMessageReaction({ reaction: "love" }), {
  emoji: "❤️",
  count: 1,
  mine: false,
});

/* ---------------------------------------------------------------- setting -- */

/* Nobody has reacted: the emoji is added, owned by the viewer. */
assert.deepEqual(setLocal([], "👍"), [{ emoji: "👍", count: 1, mine: true }]);

/* Somebody else reacted: joining raises the count and claims it. */
assert.deepEqual(setLocal([{ emoji: "👍", count: 2, mine: false }], "👍"), [
  { emoji: "👍", count: 3, mine: true },
]);

/* THE CASE WORTH THE FILE: one per person, so a second pick MOVES the reaction.
   The old chip loses its last holder and goes; the new one arrives owned. */
assert.deepEqual(setLocal([{ emoji: "👍", count: 1, mine: true }], "❤️"), [
  { emoji: "❤️", count: 1, mine: true },
]);

/* The same move while others still hold the old one: it survives, minus the
   viewer, and is NOT marked mine any more. */
assert.deepEqual(setLocal([{ emoji: "👍", count: 3, mine: true }], "❤️"), [
  { emoji: "👍", count: 2, mine: false },
  { emoji: "❤️", count: 1, mine: true },
]);

/* Reactions the viewer never held are untouched, and order is preserved —
   chips must not reshuffle under the cursor when one of them is clicked. */
assert.deepEqual(
  setLocal(
    [
      { emoji: "👍", count: 4, mine: false },
      { emoji: "😂", count: 1, mine: true },
    ],
    "😢",
  ),
  [
    { emoji: "👍", count: 4, mine: false },
    { emoji: "😢", count: 1, mine: true },
  ],
);

/* --------------------------------------------------------------- clearing -- */

/* The last holder leaving removes the chip rather than leaving one at "0". */
assert.deepEqual(clearLocal([{ emoji: "👍", count: 1, mine: true }]), []);

/* Leaving one others still hold lowers the count and releases it. */
assert.deepEqual(clearLocal([{ emoji: "👍", count: 3, mine: true }]), [
  { emoji: "👍", count: 2, mine: false },
]);

/* Clearing finds the row by `mine`, not by character — which is exactly what
   lets `DELETE .../reaction` carry no emoji. */
assert.deepEqual(
  clearLocal([
    { emoji: "👍", count: 1, mine: false },
    { emoji: "❤️", count: 1, mine: true },
  ]),
  [{ emoji: "👍", count: 1, mine: false }],
);

/* Nothing held: a no-op, not a crash. */
assert.deepEqual(clearLocal([{ emoji: "👍", count: 2, mine: false }]), [
  { emoji: "👍", count: 2, mine: false },
]);

/* Neither function mutates its input: the caller keeps it to roll back a
   failed request. */
const before = [{ emoji: "👍", count: 1, mine: true }];
setLocal(before, "❤️");
clearLocal(before);
assert.deepEqual(before, [{ emoji: "👍", count: 1, mine: true }]);

/* ----------------------------------------------------------------- grids -- */

/*
 * The grids themselves, because both are hand-maintained lists where the
 * failure mode is silent. A duplicate renders twice and looks like a typo
 * nobody notices; a count that is not a multiple of the column span leaves a
 * ragged last row that reads as a rendering bug rather than a data one.
 */
assert.equal(COMPOSER_EMOJI.length, 96);
assert.equal(COMPOSER_EMOJI.length % 12, 0, "the grid is twelve columns wide");
assert.equal(
  new Set(COMPOSER_EMOJI).size,
  COMPOSER_EMOJI.length,
  "an emoji appears twice in the composer grid",
);
assert.equal(new Set(REACTIONS.map((r) => r.emoji)).size, REACTIONS.length);
/* Names are the wire value, so a duplicate would silently alias two chips. */
assert.equal(new Set(REACTIONS.map((r) => r.name)).size, REACTIONS.length);

/* Every reaction is also typeable. Someone who reacts 😮 and then wants to say
   it in words should not have to go to the OS picker for the same character. */
for (const { emoji } of REACTIONS) {
  assert.ok(COMPOSER_EMOJI.includes(emoji), `${emoji} is not in the composer grid`);
}

console.log("reactions: ok");
