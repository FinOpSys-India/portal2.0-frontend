/**
 * The optimistic reaction toggle. Run: npx tsx src/lib/reactions.test.ts
 *
 * `toggleLocal` is the one piece of reaction handling that is real logic rather
 * than markup: a chip has to appear, grow, shrink and disappear from the same
 * click, before the server has answered, and the case that actually bites is
 * the last one — decrementing a count of 1 leaves a chip reading "0" unless the
 * entry is removed outright.
 */
import assert from "node:assert/strict";

import { toggleLocal } from "./reactions";

/* Nobody has reacted: the emoji is added, owned by the viewer. */
assert.deepEqual(toggleLocal([], "👍"), [{ emoji: "👍", count: 1, mine: true }]);

/* Somebody else reacted: joining raises the count and claims it. */
assert.deepEqual(toggleLocal([{ emoji: "👍", count: 2, mine: false }], "👍"), [
  { emoji: "👍", count: 3, mine: true },
]);

/* Leaving a reaction others still hold lowers the count and releases it. */
assert.deepEqual(toggleLocal([{ emoji: "👍", count: 3, mine: true }], "👍"), [
  { emoji: "👍", count: 2, mine: false },
]);

/* THE CASE WORTH THE FILE: the last holder leaving removes the chip rather
   than leaving one that reads "0". */
assert.deepEqual(toggleLocal([{ emoji: "👍", count: 1, mine: true }], "👍"), []);

/* Other emoji on the same message are untouched, and order is preserved —
   chips must not reshuffle under the cursor when one of them is clicked. */
assert.deepEqual(
  toggleLocal(
    [
      { emoji: "👍", count: 1, mine: false },
      { emoji: "😂", count: 1, mine: true },
    ],
    "😂",
  ),
  [{ emoji: "👍", count: 1, mine: false }],
);

/* A new emoji lands at the end, after the ones already there. */
assert.deepEqual(
  toggleLocal([{ emoji: "👍", count: 1, mine: false }], "❤️"),
  [
    { emoji: "👍", count: 1, mine: false },
    { emoji: "❤️", count: 1, mine: true },
  ],
);

/* The input is not mutated: the caller keeps it to roll back a failed call. */
const before = [{ emoji: "👍", count: 1, mine: true }];
toggleLocal(before, "👍");
assert.deepEqual(before, [{ emoji: "👍", count: 1, mine: true }]);

console.log("reactions: ok");
