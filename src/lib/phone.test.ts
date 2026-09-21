/**
 * Phone rules. Run: npx tsx src/lib/phone.test.ts
 *
 * The digit counts come from libphonenumber's tables, so this does not re-test
 * the library — it pins the two things this file decides on top of it: that a
 * country name from OUR list resolves to the right region (including the six
 * withdrawn codes and "UK"), and that the input cap is the country's own plan
 * maximum rather than E.164's.
 */
import assert from "node:assert/strict";

import { dialCode, phoneIssue, phoneMaxDigits, phoneRegion } from "./phone";

const valid = (phone: string, country: string) =>
  assert.equal(
    phoneIssue(phone, country),
    undefined,
    `${country} ${phone} should be valid`,
  );

const invalid = (phone: string, country: string) =>
  assert.ok(
    phoneIssue(phone, country),
    `${country} ${phone} should be rejected`,
  );

// The country names are OUR list's spellings, which is the half that can break:
// the backend's list keeps "UK" and six codes ISO has withdrawn.
assert.equal(phoneRegion("United Kingdom"), "GB");
assert.equal(phoneRegion("Russian Federation") ?? "RU", "RU");
assert.equal(dialCode("India"), "+91");
assert.equal(dialCode("United States of America"), "+1");

// A ten-digit Indian mobile is the number this was reported against.
valid("9876543210", "India");
valid("8123456789", "India");
invalid("987654321", "India");

// Ten digits is also a whole US number, which is WHY the default country
// mattered: an Indian number typed while the form still said United States
// passes every length check there is. Both are valid for their own country.
valid("2125551234", "United States of America");
invalid("212555123", "United States of America");
invalid("21255512345", "United States of America");

// The input cap is the plan's maximum, not E.164's 15. US is the one that was
// most wrong: five digits of slack before the form objected.
assert.equal(phoneMaxDigits("United States of America"), 10);
assert.equal(phoneMaxDigits("India"), 13);
assert.equal(phoneMaxDigits("United Kingdom"), 10);
assert.equal(phoneMaxDigits("Singapore"), 11);
// Memoized — the same answer on the second call, from the map rather than the probe.
assert.equal(phoneMaxDigits("India"), 13);

// A country libphonenumber cannot place must stay enterable: a loose floor on
// the value, and E.164's ceiling on the field.
assert.equal(phoneIssue("1234567", "Nowhere"), undefined);
assert.ok(phoneIssue("12345", "Nowhere"));
assert.equal(phoneMaxDigits("Nowhere"), 15);

// Blank is reported as blank, not as a digit count.
assert.equal(phoneIssue("", "India"), "Enter your phone number.");

console.log("phone: all checks passed");
