/**
 * What survives of reaction handling. Run: npx tsx src/lib/reactions.test.ts
 *
 * The optimistic-state helpers are gone with the writes: `PUT`/`DELETE
 * /chat/messages/:id/reaction` exist on no backend, so nothing sets a reaction
 * from this client any more. What is left is the READ — a message arrives
 * carrying reactions as wire names, and `toMessageReaction` turns one row into
 * the shape a chip would draw.
 */
import assert from "node:assert/strict";

import { COMPOSER_EMOJI, reactionEmoji, toMessageReaction } from "./reactions";

/* ---------------------------------------------------------------- naming -- */

/* A wire name resolves to its character. */
assert.equal(reactionEmoji("love"), "❤️");

/* An unknown name renders as itself rather than as a blank chip. */
assert.equal(reactionEmoji("shipped"), "shipped");

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
console.log("reactions: ok");
