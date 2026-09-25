/**
 * The deadline floor. Run: npx tsx src/lib/dates.test.ts
 *
 * `tomorrow()` is what stops a deadline being set in the past, so the day it
 * names has to be the READER'S tomorrow. The version this replaced called
 * `toISOString()` on a local date, which converts to UTC first — east of
 * Greenwich late in the day that lands on the day after tomorrow, and west of
 * it in the morning on today, which is the one day the rule exists to exclude.
 */
import assert from "node:assert/strict";

import { tomorrow } from "./dates";

const value = tomorrow();

/* The shape a date input's `min` requires. */
assert.match(value, /^\d{4}-\d{2}-\d{2}$/);

/* It is the local calendar's tomorrow, built the same way from scratch. */
const expected = new Date();
expected.setDate(expected.getDate() + 1);
assert.equal(
  value,
  `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`,
);

/* Strictly after today, whatever the timezone — the property that matters. */
const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
assert.ok(value > todayKey, "tomorrow must sort after today");

console.log("dates: all checks passed");
