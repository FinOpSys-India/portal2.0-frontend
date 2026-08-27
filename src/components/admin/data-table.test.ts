/**
 * Paging window check. Run: npx tsx src/components/admin/data-table.test.ts
 *
 * One table serves two paging models — server-paged admin lists that hand over
 * a single page, and customer lists that hand over everything and page locally.
 * Getting that wrong is silent in both directions: slice a server page and rows
 * vanish, skip slicing a full set and the pager renders but does nothing.
 */
import assert from "node:assert/strict";

import { pageWindow } from "./data-table";
import { PAGE_SIZE } from "../../lib/admin";

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

  /* ------------------------------------------------------------- empty ---- */

  const none = pageWindow(rows(0), 0, 1);
  assert.deepEqual(none.shown, []);
  assert.equal(none.pages, 1);
  assert.equal(none.first, 0);
  assert.equal(none.last, 0);

  console.log("data table paging: all checks passed");
}

main();
