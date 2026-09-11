/**
 * Paging window check. Run: npx tsx src/components/admin/data-table.test.ts
 *
 * One table serves two paging models — server-paged admin lists that hand over
 * a single page, and customer lists that hand over everything and page locally.
 * Getting that wrong is silent in both directions: slice a server page and rows
 * vanish, skip slicing a full set and the pager renders but does nothing.
 */
import assert from "node:assert/strict";

import {
  filterFields,
  filterRows,
  pageWindow,
  sortRows,
  type Column,
  type SortableColumn,
} from "./data-table";
import { parseFilters } from "../../lib/table-filter";
import {
  PAGE_SIZE,
  PAGE_SIZES,
  parsePage,
  parsePageSize,
} from "../../lib/admin";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

async function main() {
  /* ------------------------------------------------ server-paged callers -- */

  // The admin case: 10 rows handed over, 34 in the database. Nothing may be
  // sliced away — these ten ARE page two.
  const server = pageWindow(rows(PAGE_SIZE), 34, 2);
  assert.equal(server.shown.length, PAGE_SIZE);
  assert.deepEqual(server.shown, rows(PAGE_SIZE));
  assert.equal(server.pages, 4);
  assert.equal(server.first, 11);
  assert.equal(server.last, 20);

  // Fewer rows than a page, which is every short admin list.
  const short = pageWindow(rows(3), 3, 1);
  assert.deepEqual(short.shown, [0, 1, 2]);
  assert.equal(short.pages, 1);
  assert.equal(short.last, 3);

  /* ------------------------------------------------- locally-paged callers */

  // The customer case: all 25 rows handed over at once.
  const all = pageWindow(rows(25), 25, 1);
  assert.equal(all.shown.length, PAGE_SIZE);
  assert.equal(all.shown[0], 0);
  assert.equal(all.pages, 3);

  // Page two must actually move — the bug this exists to catch.
  const second = pageWindow(rows(25), 25, 2);
  assert.equal(second.shown[0], PAGE_SIZE);
  assert.notDeepEqual(second.shown, all.shown);

  // The last page is the remainder, not a full page.
  const third = pageWindow(rows(25), 25, 3);
  assert.equal(third.shown.length, 5);
  assert.equal(third.last, 25);

  /* --------------------------------------------------------- URL abuse ---- */

  // ?page= comes off the URL, so it is whatever someone typed.
  assert.equal(pageWindow(rows(25), 25, 99).current, 3);
  assert.equal(pageWindow(rows(25), 25, 0).current, 1);
  assert.equal(pageWindow(rows(25), 25, -4).current, 1);
  assert.equal(pageWindow(rows(25), 25, NaN).current, 1);
  // Clamped to the last page, so it still renders rows rather than nothing.
  assert.equal(pageWindow(rows(25), 25, 99).shown.length, 5);

  /* ---------------------------------------------------- rows per page ---- */

  // The size box writes ?size=, and both paging models have to honour it: the
  // window, the page count and the "Showing x–y" line all move with it.
  const wide = pageWindow(rows(25), 25, 1, 25);
  assert.equal(wide.shown.length, 25);
  assert.equal(wide.pages, 1);
  assert.equal(wide.last, 25);

  const bySeven = pageWindow(rows(25), 25, 3, 7);
  assert.deepEqual(bySeven.shown, [14, 15, 16, 17, 18, 19, 20]);
  assert.equal(bySeven.pages, 4);
  assert.equal(bySeven.first, 15);

  // A server page of 25 is still handed over whole — the size it was fetched
  // with is the size it is shown at.
  const serverWide = pageWindow(rows(25), 90, 2, 25);
  assert.deepEqual(serverWide.shown, rows(25));
  assert.equal(serverWide.first, 26);

  // ?size= comes off the URL too. Anything that is not a count falls back to
  // ten, and a typed number is capped at what the API will serve.
  assert.equal(parsePageSize(undefined), PAGE_SIZE);
  assert.equal(parsePageSize("abc"), PAGE_SIZE);
  assert.equal(parsePageSize("0"), PAGE_SIZE);
  assert.equal(parsePageSize("-5"), PAGE_SIZE);
  assert.equal(parsePageSize("7"), 7);
  assert.equal(parsePageSize("25.9"), 25);
  assert.equal(parsePageSize("4000"), Math.max(...PAGE_SIZES));

  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-3"), 1);
  assert.equal(parsePage("4"), 4);

  /* ------------------------------------------------------------- empty ---- */

  const none = pageWindow(rows(0), 0, 1);
  assert.deepEqual(none.shown, []);
  assert.equal(none.pages, 1);
  assert.equal(none.first, 0);
  assert.equal(none.last, 0);

  /* -------------------------------------------------------------- sorting */

  type Row = { name: string; deadline: string; team: number };
  const table: Row[] = [
    { name: "beta", deadline: "8/03/26", team: 2 },
    { name: "Alpha", deadline: "7/28/26", team: 10 },
    { name: "", deadline: "1/01/27", team: 0 },
  ];
  const columns: SortableColumn<Row>[] = [
    { header: "Name", cell: (r) => r.name },
    // Same shape the deadline columns use: parsed, because as text "8/03/26"
    // sorts before "7/28/26".
    {
      header: "Deadline",
      sortValue: (r) => {
        const [month, day, year] = r.deadline.split("/").map(Number);
        return new Date(2000 + year, month - 1, day).getTime();
      },
    },
    { header: "Team", sortValue: (r) => r.team },
    { header: "Action", sortValue: false, cell: () => "button" },
  ];
  const names = (sort?: string, dir?: string) =>
    sortRows(table, columns, sort, dir).map((r) => r.name);

  // Case-insensitive, and the blank sits last in BOTH directions — an empty
  // cell is a missing value, not the smallest one.
  assert.deepEqual(names("Name", "asc"), ["Alpha", "beta", ""]);
  assert.deepEqual(names("Name", "desc"), ["beta", "Alpha", ""]);

  // Numbers compare as numbers: 10 after 2, not before it.
  assert.deepEqual(names("Team", "asc"), ["", "beta", "Alpha"]);

  // Dates by their timestamp, so July precedes August precedes January 2027.
  assert.deepEqual(names("Deadline", "asc"), ["Alpha", "beta", ""]);

  // `sortValue: false`, an unknown column and no column at all all leave the
  // rows exactly as they came — ?sort= is whatever someone typed.
  assert.deepEqual(names("Action", "asc"), ["beta", "Alpha", ""]);
  assert.deepEqual(names("Nonexistent", "asc"), ["beta", "Alpha", ""]);
  assert.deepEqual(names(undefined, "asc"), ["beta", "Alpha", ""]);

  // The rows handed in are not reordered in place — DataTable pages the result.
  assert.equal(table[0].name, "beta");

  /* ------------------------------------------------------------ filters -- */

  type Project = { name: string; status: string; deadline: string; progress: number };
  const projects: Project[] = [
    { name: "Payroll Q3", status: "Active", deadline: "7/28/26", progress: 40 },
    { name: "Tax Filing", status: "On Hold", deadline: "8/03/26", progress: 0 },
    { name: "Audit", status: "Active", deadline: "1/01/27", progress: 100 },
  ];
  const projectColumns: Column<Project>[] = [
    { header: "Project Name", cell: (r) => r.name },
    { header: "Status", filter: "enum", sortValue: (r) => r.status, cell: (r) => r.status },
    {
      header: "Deadline",
      filter: "date",
      sortValue: (r) => {
        const [month, day, year] = r.deadline.split("/").map(Number);
        return new Date(2000 + year, month - 1, day).getTime();
      },
      cell: (r) => r.deadline,
    },
    { header: "Progress", filter: "number", sortValue: (r) => r.progress, cell: (r) => r.progress },
    { header: "Action", sortValue: false, cell: () => "button" },
  ];
  const matching = (query: string | string[]) =>
    filterRows(projects, projectColumns, parseFilters(query)).map((p) => p.name);

  // Text columns need no annotation: they filter on the text the cell renders.
  assert.deepEqual(matching("Project%20Name:contains:tax"), ["Tax Filing"]);
  assert.deepEqual(matching("Status:in:Active"), ["Payroll Q3", "Audit"]);
  assert.deepEqual(matching("Status:notin:Active"), ["Tax Filing"]);

  // A date filters on the timestamp it sorts on, not on "8/03/26" as text.
  assert.deepEqual(matching("Deadline:before:2026-08-01"), ["Payroll Q3"]);
  assert.deepEqual(matching("Progress:gte:40"), ["Payroll Q3", "Audit"]);

  // Several filters narrow together — each chip added is a further AND.
  assert.deepEqual(
    matching(["Status:in:Active", "Progress:gte:100"]),
    ["Audit"],
  );

  // Nothing matching is an empty table, not the unfiltered list.
  assert.deepEqual(matching("Status:in:Cancelled"), []);

  // A filter on a column this table does not have, or one that opted out of
  // sorting, leaves every row — same rule as an unknown ?sort=.
  assert.deepEqual(matching("Nonexistent:is:x").length, 3);
  assert.deepEqual(matching("Action:is:button").length, 3);
  assert.deepEqual(matching([]).length, 3);

  // Rows are not reordered or mutated on the way through.
  assert.equal(projects[0].name, "Payroll Q3");

  /* --------------------------------------------------- multi-value cols -- */

  type Person = { name: string; companies: string[] };
  const people: Person[] = [
    { name: "Ada", companies: ["Acme Air", "Zephyr Freight"] },
    { name: "Bo", companies: ["SkyBridge Aviation"] },
    { name: "Cy", companies: [] },
  ];
  const peopleColumns: Column<Person>[] = [
    { header: "Name", cell: (r) => r.name },
    {
      header: "Companies",
      // Sorts as the reader sees it, filters as separate values — the two are
      // different questions about the same cell.
      sortValue: (r) => r.companies.join(", "),
      filter: "list",
      filterValues: (r) => r.companies,
      filterOptions: ["Acme Air", "Nothing Ltd", "SkyBridge Aviation", "Zephyr Freight"],
      cell: (r) => r.companies.join(", "),
    },
  ];
  const whoIsOn = (query: string) =>
    filterRows(people, peopleColumns, parseFilters(query)).map((p) => p.name);

  // One of several companies is enough — Ada is on two.
  assert.deepEqual(whoIsOn("Companies:in:Zephyr%20Freight"), ["Ada"]);
  assert.deepEqual(
    whoIsOn("Companies:in:Acme%20Air|SkyBridge%20Aviation"),
    ["Ada", "Bo"],
  );
  assert.deepEqual(whoIsOn("Companies:notin:Acme%20Air"), ["Bo", "Cy"]);

  // The checklist offers every company the page knows about, not only the ones
  // the loaded rows happen to hold — "Nothing Ltd" is on nobody and still
  // listed, sorted with the rest.
  const peopleFields = filterFields(peopleColumns, people);
  assert.equal(peopleFields[1].type, "list");
  assert.deepEqual(peopleFields[1].options, [
    "Acme Air",
    "Nothing Ltd",
    "SkyBridge Aviation",
    "Zephyr Freight",
  ]);

  // The number beside each checkbox counts ROWS holding that value. A person
  // on no company adds nothing, and a company nobody is on has no count at all
  // — which is what the pane renders as a blank rather than a zero.
  // Before the whole-object compare, not after: `assert.deepEqual` under
  // node:assert/strict is `deepStrictEqual`, which is typed `asserts actual is
  // T` — so it narrows `counts` to the literal shape below and a later lookup
  // of a key outside it stops compiling.
  assert.equal(peopleFields[1].counts?.["Nothing Ltd"], undefined);
  assert.deepEqual(peopleFields[1].counts, {
    "Acme Air": 1,
    "SkyBridge Aviation": 1,
    "Zephyr Freight": 1,
  });

  // Without that list, the options are what the rows hold — each value on its
  // own, never the joined line the cell renders.
  const derived = filterFields(
    [{ ...peopleColumns[1], filterOptions: undefined }],
    people,
  );
  assert.deepEqual(derived[0].options, [
    "Acme Air",
    "SkyBridge Aviation",
    "Zephyr Freight",
  ]);

  /* ------------------------------------------------------- filter fields -- */

  const fields = filterFields(projectColumns, projects);

  // The button column offers no filter; everything else does, typed.
  assert.deepEqual(
    fields.map((f) => `${f.header}:${f.type}`),
    ["Project Name:text", "Status:enum", "Deadline:date", "Progress:number"],
  );

  // Enum options come from the rows on hand, deduped and sorted — a status
  // nothing holds is never offered, since filtering to it shows nothing.
  assert.deepEqual(fields[1].options, ["Active", "On Hold"]);
  assert.equal(fields[0].options, undefined);

  console.log("data table paging, sorting and filtering: all checks passed");
}

main();
