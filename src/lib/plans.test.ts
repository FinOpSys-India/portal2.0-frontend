/**
 * Pricing check. Run: npx tsx src/lib/plans.test.ts
 *
 * The order total is the one piece of arithmetic on the page a customer can
 * verify against their card statement, so it gets a test. Minor units
 * throughout, matching the catalog the amounts now come from.
 */
import assert from "node:assert/strict";

import { toCatalog, type BackendCatalog } from "./billing";
import {
  BOOKKEEPING_TIERS,
  TAX_TIERS,
  formatMoney,
  payrollTotal,
} from "./plans";

// The combination captured from the live app: Starter + 2 W-2 + 3 contractors
// + the $500K–$2M tax band showed a $313/mo total.
const starter = BOOKKEEPING_TIERS.find((t) => t.id === "starter")!;
const taxes = TAX_TIERS.find((t) => t.id === "500k-2m")!;

assert.equal(starter.priceMinor, 9900);
assert.equal(taxes.priceMinor, 12500);
assert.equal(payrollTotal(2, 3), 8900, "2900 base + 2x1500 + 3x1000");
assert.equal(
  starter.priceMinor + payrollTotal(2, 3) + taxes.priceMinor,
  31300,
  "matches the $313/mo the live app quoted",
);

// Payroll with nobody on it is still the base fee, not free.
assert.equal(payrollTotal(0, 0), 2900);

// Every tier is priced and ordered cheapest first.
const prices = BOOKKEEPING_TIERS.map((t) => t.priceMinor);
assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
assert.ok(prices.every((p) => p > 0));

assert.equal(formatMoney(123400), "$1,234");
// The catalog is free to return a price the old whole-dollar model could not.
assert.equal(formatMoney(12550), "$125.50");

/* ---------------------------------------------------------------- catalog -- */

const option = (over: Partial<BackendCatalog["bookkeeping"][number]>) => ({
  optionId: "bookkeeping_option_1",
  name: "Starter",
  unitAmountMinor: 10900,
  currency: "USD",
  billingInterval: "month",
  displayOrder: 1,
  quantityEnabled: false,
  ...over,
});

const response: BackendCatalog = {
  currency: "USD",
  bookkeeping: [
    option({}),
    option({ optionId: "bookkeeping_option_9", name: "Enterprise", unitAmountMinor: 199900 }),
  ],
  taxes: [option({ optionId: "tax_option_2", name: "$500K – $2M revenue", unitAmountMinor: 13500 })],
  payroll: [
    {
      planId: "payroll_standard",
      components: {
        base: option({ optionId: "payroll_standard", unitAmountMinor: 3100 }),
        employees: option({ optionId: "payroll_standard", unitAmountMinor: 1600 }),
        contractors: option({ optionId: "payroll_standard", unitAmountMinor: 1100 }),
      },
    },
  ],
};

const catalog = toCatalog(response);

// The SERVER's price wins over the one this app shipped with — that is the
// whole point of reading the catalog.
assert.equal(catalog.bookkeeping[0].priceMinor, 10900);
assert.equal(catalog.bookkeeping[0].id, "starter", "local id kept, so selection still keys");
assert.equal(catalog.bookkeeping[0].detail, "Up to 50 transactions", "local copy kept");

// A tier this app has never heard of is still sellable, keyed by its option id.
assert.equal(catalog.bookkeeping[1].id, "bookkeeping_option_9");
assert.equal(catalog.bookkeeping[1].detail, "");

// Tax bands carry copy the catalog has no column for.
assert.equal(catalog.taxes[0].priceMinor, 13500);
assert.equal(catalog.taxes[0].additionalStateMinor, 12900);

// Payroll's three components, and the total they add up to at real counts.
assert.equal(payrollTotal(2, 3, catalog.payroll), 3100 + 2 * 1600 + 3 * 1100);
assert.equal(catalog.live, true);

// A deployment with no seeded plans falls back rather than rendering a shop
// with nothing in it.
const empty = toCatalog({ currency: "USD", bookkeeping: [], taxes: [], payroll: [] });
assert.equal(empty.live, false);
assert.deepEqual(empty.bookkeeping, BOOKKEEPING_TIERS);

console.log("plans: all checks passed");
