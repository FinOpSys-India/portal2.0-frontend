/**
 * Storing a phone number with its country. Run: npx tsx src/lib/phone.test.ts
 *
 * Every phone field here is a country picker beside a box of national digits,
 * and only the digits used to be sent — so a record held `8887502268` with
 * nothing to say where it belonged. These two functions are the join and the
 * split, and the split has to be exact: it runs on every edit, and a number it
 * mangles is one the user then saves back mangled.
 */
import assert from "node:assert/strict";

import { dialCode, stripDialCode, withDialCode } from "./phone";

/* ------------------------------------------------------------- joining -- */

assert.equal(withDialCode("8887502268", "India"), "+91 8887502268");
assert.equal(
  withDialCode("5551234567", "United States of America"),
  "+1 5551234567",
);

/* ALREADY CARRIES ONE. A record re-saved after an edit must not collect a
   second code — this is the case that would turn +91 into +91 +91. */
assert.equal(withDialCode("+91 8887502268", "India"), "+91 8887502268");

/* An unknown country is not a reason to refuse the number the user typed. */
assert.equal(withDialCode("8887502268", "Atlantis"), "8887502268");
assert.equal(withDialCode("8887502268", ""), "8887502268");

/* Nothing typed stays nothing: the field is optional on some forms. */
assert.equal(withDialCode("", "India"), "");
assert.equal(withDialCode("   ", "India"), "");

/* ----------------------------------------------------------- splitting -- */

assert.equal(stripDialCode("+91 8887502268", "India"), "8887502268");
/* Stored without a space, which is what a hand-typed E.164 looks like. */
assert.equal(stripDialCode("+918887502268", "India"), "8887502268");

/* A LEGACY VALUE, saved before any of this. Returned whole rather than cut. */
assert.equal(stripDialCode("8887502268", "India"), "8887502268");

/*
 * A code that is NOT this country's is left alone. `+1` is the United States
 * and Canada both, so the country on the record is the only thing that can say
 * which prefix belongs to it — and a number stored under a country the record
 * no longer names is still a number.
 */
assert.equal(stripDialCode("+1 5551234567", "India"), "+1 5551234567");

/* Round trip, which is the property that matters on an edit-and-save. */
for (const [n, c] of [
  ["8887502268", "India"],
  ["5551234567", "United States of America"],
] as const) {
  assert.equal(stripDialCode(withDialCode(n, c), c), n, `${c} round trip`);
  assert.ok(withDialCode(n, c).startsWith(dialCode(c)));
}

/* ------------------------------------------------ legacy rows on screen -- */

/*
 * The same join runs at DISPLAY time on records saved before any code was
 * stored, so a detail page shows a dialable number instead of bare digits. It
 * has to be idempotent for that to be safe: the adapters cannot tell a legacy
 * row from a new one, and they run on both.
 */
assert.equal(withDialCode("8887502268", "India"), "+91 8887502268");
assert.equal(withDialCode("+91 8887502268", "India"), "+91 8887502268");

/* A record with no country renders what was stored rather than inventing a
   code. This is the honest failure: incomplete beats wrong. */
assert.equal(withDialCode("8887502268", ""), "8887502268");

console.log("phone: all checks passed");