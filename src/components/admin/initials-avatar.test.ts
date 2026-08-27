/**
 * Initials check. Run: npx tsx src/components/admin/initials-avatar.test.ts
 *
 * Names are messier than "First Last" — the fixture data alone has lowercase
 * names and multi-word companies — so the parsing gets a test.
 */
import assert from "node:assert/strict";

import { initialsOf, tintFor } from "./initials-avatar";

assert.equal(initialsOf("Priya Nair"), "PN");
assert.equal(initialsOf("Maya Reyes"), "MR");

// Middle names must not take the second slot; the surname does.
assert.equal(initialsOf("Ada Beatrice King"), "AK");

// Single word: two letters beats one lonely character.
assert.equal(initialsOf("Cher"), "CH");
assert.equal(initialsOf("A"), "A");

// Lowercase input still renders uppercase initials.
assert.equal(initialsOf("shubham gupta"), "SG");

// Whitespace noise, including the double space seen in real records.
assert.equal(initialsOf("  Test   Customer  "), "TC");
assert.equal(initialsOf("Test  Customer"), "TC");

// Nothing usable: a placeholder rather than an empty circle.
assert.equal(initialsOf(""), "?");
assert.equal(initialsOf("   "), "?");

/* ------------------------------------------------------------- tints ---- */

// Same person, same colour — every call, every page. A tint that changed on
// reload would be worse than no tint at all.
assert.deepEqual(tintFor("Priya Nair"), tintFor("Priya Nair"));

// Casing and stray whitespace must not shift the colour, since the same
// person appears differently punctuated across records.
assert.deepEqual(tintFor("priya nair"), tintFor("  Priya   Nair "));

// Distinct people should generally differ, or the palette is decorative only.
const sample = [
  "Maya Reyes",
  "Tom Becker",
  "Priya Nair",
  "Daniel Okafor",
  "Alex Morgan",
];
const distinct = new Set(sample.map((n) => tintFor(n).bg));
assert.ok(
  distinct.size >= 3,
  `expected a spread of tints across ${sample.length} names, got ${distinct.size}`,
);

console.log("initials: all checks passed");
