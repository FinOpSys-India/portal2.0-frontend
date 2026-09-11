/**
 * The filter language: what `?f=` means, and what it must not blow up on.
 *
 * The URL is user input — typed, pasted, bookmarked before a column was
 * renamed — so half of this is about junk arriving and the list staying
 * readable anyway.
 */
import assert from "node:assert/strict";

import {
  byInitial,
  matchesFilter,
  parseFilters,
  rangeFilter,
  rangeValues,
  serializeFilter,
  toDateValue,
  fromDateValue,
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

  /* ------------------------------------------------------------- range --- */

  // The pane is two boxes and no operator menu, so which boxes were filled is
  // what picks the operator.
  assert.deepEqual(rangeFilter("Progress", "50", "", "number"), {
    field: "Progress",
    op: "gte",
    values: ["50"],
  });
  assert.deepEqual(rangeFilter("Progress", "", "80", "number"), {
    field: "Progress",
    op: "lte",
    values: ["80"],
  });
  assert.deepEqual(rangeFilter("Progress", "50", "80", "number"), {
    field: "Progress",
    op: "between",
    values: ["50", "80"],
  });
  // A date's lower end is `after`, which is the operator its own column type
  // has a label for; both compare the same way.
  assert.equal(rangeFilter("Deadline", "2026-09-01", "", "date")?.op, "after");
  // Neither end filled is not a filter at all — an empty pane must not narrow
  // the list to nothing.
  assert.equal(rangeFilter("Progress", "", "", "number"), null);
  assert.equal(rangeFilter("Progress", "  ", " ", "number"), null);

  // Closing the upper end INCLUDES the named day: `lte` on a date runs to the
  // end of it, where `before` would stop at its midnight.
  const upTo = rangeFilter("Deadline", "", "2026-09-30", "date")!;
  assert.equal(matchesFilter(day(2026, 9, 30), upTo, "date"), true);
  assert.equal(matchesFilter(day(2026, 10, 1), upTo, "date"), false);

  // Reopening the pane shows what is applied: every shape round-trips, and one
  // value lands in the box the operator says it belongs to.
  for (const [from, to] of [
    ["50", "80"],
    ["50", ""],
    ["", "80"],
    ["", ""],
  ]) {
    const filter = rangeFilter("Progress", from, to, "number");
    assert.deepEqual(rangeValues(filter ?? undefined), [from, to]);
  }

  /* ----------------------------------------------- multi-value cells ---- */

  // A cell holding several values — the companies a customer is on — passes on
  // ANY of them. Selecting one company must not require it to be the only one.
  const companies = ["Acme Air", "SkyBridge Aviation", "Zephyr Freight"];
  const on = (op: "in" | "notin", values: string[]) =>
    matchesFilter(companies, { field: "Companies", op, values }, "list");

  assert.equal(on("in", ["SkyBridge Aviation"]), true);
  assert.equal(on("in", ["Nothing Ltd"]), false);
  // Several selected is an OR within the one filter, which is what "is any of"
  // says on the chip.
  assert.equal(on("in", ["Nothing Ltd", "Acme Air"]), true);
  assert.equal(on("notin", ["Acme Air"]), false);
  assert.equal(on("notin", ["Nothing Ltd"]), true);

  // "All of these": every named value has to be on the row, which is the
  // question the Any/All toggle asks.
  const all = (values: string[]) =>
    matchesFilter(companies, { field: "Companies", op: "all", values }, "list");
  assert.equal(all(["Acme Air", "Zephyr Freight"]), true);
  assert.equal(all(["Acme Air", "Nothing Ltd"]), false);
  assert.equal(all(["Acme Air"]), true);

  // A customer on no company at all is the empty case, not a row with a blank
  // name in it.
  assert.equal(
    matchesFilter([], { field: "Companies", op: "empty", values: [] }, "list"),
    true,
  );
  assert.equal(
    matchesFilter(
      companies,
      { field: "Companies", op: "empty", values: [] },
      "list",
    ),
    false,
  );

  // Single values are the one-item case of the same rule — unchanged.
  assert.equal(
    matchesFilter("Active", { field: "Status", op: "in", values: ["Active"] }, "enum"),
    true,
  );
  assert.equal(
    matchesFilter("Active", { field: "Status", op: "in", values: ["On Hold"] }, "enum"),
    false,
  );

  /* ------------------------------------------------ checklist letters ---- */

  // Long lists are read by initial. Accented and non-letter initials still
  // land somewhere sensible rather than each opening a group of their own.
  assert.deepEqual(
    byInitial(["3M Freight", "Acme Air", "Ålesund Air", "Boreal Ltd"], true),
    [
      ["#", ["3M Freight"]],
      ["A", ["Acme Air", "Ålesund Air"]],
      ["B", ["Boreal Ltd"]],
    ],
  );

  // A short list is one group with no heading — a four-value status column is
  // read whole.
  assert.deepEqual(byInitial(["Active", "On Hold"], false), [
    ["", ["Active", "On Hold"]],
  ]);

  /* ------------------------------------------------- calendar values ---- */

  // What the calendar hands back and what the URL carries are the same day, in
  // the reader's timezone — `toISOString` here would slide it west of
  // Greenwich onto the day before.
  assert.equal(toDateValue(new Date(2026, 8, 30)), "2026-09-30");
  assert.equal(toDateValue(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(toDateValue(undefined), "");

  assert.equal(fromDateValue("2026-09-30")?.getTime(), day(2026, 9, 30));
  assert.equal(fromDateValue(""), undefined);
  assert.equal(fromDateValue("not-a-date"), undefined);

  // Round trip, including a day that crosses a DST boundary in most zones.
  for (const date of [new Date(2026, 2, 29), new Date(2026, 9, 25), new Date(2026, 11, 31)]) {
    assert.equal(fromDateValue(toDateValue(date))?.getTime(), date.getTime());
  }

  console.log("table filters: all checks passed");
}

main();
