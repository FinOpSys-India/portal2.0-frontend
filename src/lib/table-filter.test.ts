/**
 * The filter language: what `?f=` means, and what it must not blow up on.
 *
 * The URL is user input — typed, pasted, bookmarked before a column was
 * renamed — so half of this is about junk arriving and the list staying
 * readable anyway.
 */
import assert from "node:assert/strict";

import {
  matchesFilter,
  parseFilters,
  serializeFilter,
  type Filter,
} from "./table-filter";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

async function main() {
  /* ------------------------------------------------------- round trip ---- */

  const filters: Filter[] = [
    { field: "Status", op: "in", values: ["Active", "On Hold"] },
    { field: "Deadline", op: "before", values: ["2026-09-30"] },
    { field: "Company Name", op: "contains", values: ["acme"] },
  ];

  assert.deepEqual(parseFilters(filters.map(serializeFilter)), filters);

  // A single `f` arrives as a string rather than an array.
  assert.deepEqual(parseFilters(serializeFilter(filters[0])), [filters[0]]);
  assert.deepEqual(parseFilters(undefined), []);

  // Separators inside the field or the value survive, because both halves are
  // encoded: a file really can be called `a|b:c.pdf`.
  const awkward: Filter = {
    field: "File Name",
    op: "is",
    values: ["a|b:c.pdf"],
  };
  assert.deepEqual(parseFilters(serializeFilter(awkward)), [awkward]);

  /* ------------------------------------------------------------- junk ---- */

  // Unknown operator, no operator, empty field, missing value, stray percent:
  // every one is dropped, none of them throws.
  assert.deepEqual(parseFilters("Status:sideways:Active"), []);
  assert.deepEqual(parseFilters("Status"), []);
  assert.deepEqual(parseFilters(":is:Active"), []);
  assert.deepEqual(parseFilters("Status:is:"), []);
  assert.deepEqual(parseFilters("Status:is:%"), [
    { field: "Status", op: "is", values: ["%"] },
  ]);
  // `is empty` is the one operator that needs no value.
  assert.deepEqual(parseFilters("Specialist:empty:"), [
    { field: "Specialist", op: "empty", values: [] },
  ]);

  /* -------------------------------------------------------------- text --- */

  const contains: Filter = { field: "Name", op: "contains", values: ["ACME"] };
  assert.equal(matchesFilter("Acme Holdings", contains, "text"), true);
  assert.equal(matchesFilter("Globex", contains, "text"), false);

  assert.equal(
    matchesFilter("Acme", { field: "Name", op: "is", values: ["acme"] }, "text"),
    true,
  );
  assert.equal(
    matchesFilter("Acme", { field: "Name", op: "isnot", values: ["acme"] }, "text"),
    false,
  );
  assert.equal(
    matchesFilter("  ", { field: "Name", op: "empty", values: [] }, "text"),
    true,
  );
  assert.equal(
    matchesFilter("Acme", { field: "Name", op: "empty", values: [] }, "text"),
    false,
  );

  /* -------------------------------------------------------------- enum --- */

  const anyOf: Filter = {
    field: "Status",
    op: "in",
    values: ["Active", "On Hold"],
  };
  assert.equal(matchesFilter("On Hold", anyOf, "enum"), true);
  assert.equal(matchesFilter("Completed", anyOf, "enum"), false);
  assert.equal(
    matchesFilter("Completed", { ...anyOf, op: "notin" }, "enum"),
    true,
  );

  /* -------------------------------------------------------------- date --- */

  // The row value is the timestamp the column sorts on; the filter value is
  // what `<input type="date">` produces.
  const deadline = day(2026, 9, 30);
  const before: Filter = { field: "Deadline", op: "before", values: ["2026-09-30"] };

  // Its own day is not "before" it, but it IS "on or after".
  assert.equal(matchesFilter(deadline, before, "date"), false);
  assert.equal(matchesFilter(day(2026, 9, 29), before, "date"), true);
  assert.equal(matchesFilter(deadline, { ...before, op: "after" }, "date"), true);

  const between: Filter = {
    field: "Deadline",
    op: "between",
    values: ["2026-09-01", "2026-09-30"],
  };
  // Both ends included — the last day counts in full, not up to its midnight.
  assert.equal(matchesFilter(day(2026, 9, 1), between, "date"), true);
  assert.equal(matchesFilter(deadline, between, "date"), true);
  assert.equal(matchesFilter(day(2026, 10, 1), between, "date"), false);

  // A row with no date at all sorts as 0 and must not pass a range.
  assert.equal(matchesFilter(0, between, "date"), false);
  assert.equal(matchesFilter("", between, "date"), false);

  /* ------------------------------------------------------------ number --- */

  const atLeast: Filter = { field: "Progress", op: "gte", values: ["50"] };
  assert.equal(matchesFilter(50, atLeast, "number"), true);
  assert.equal(matchesFilter(49, atLeast, "number"), false);
  assert.equal(
    matchesFilter(49, { ...atLeast, op: "lte" }, "number"),
    true,
  );
  assert.equal(
    matchesFilter(
      75,
      { field: "Progress", op: "between", values: ["50", "80"] },
      "number",
    ),
    true,
  );
  // Text in a number column fails the filter rather than passing everything.
  assert.equal(matchesFilter("n/a", atLeast, "number"), false);

  console.log("table filters: all checks passed");
}

main();
