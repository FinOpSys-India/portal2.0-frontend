/**
 * Pricing check. Run: npx tsx src/lib/plans.test.ts
 *
 * The order total is the one piece of arithmetic on the page a customer can
 * verify against their card statement, so it gets a test.
 */
import assert from "node:assert/strict";

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

assert.equal(starter.price, 99);
assert.equal(taxes.price, 125);
assert.equal(payrollTotal(2, 3), 89, "29 base + 2x15 + 3x10");
assert.equal(
  starter.price + payrollTotal(2, 3) + taxes.price,
  313,
  "matches the $313/mo the live app quoted",
);

// Payroll with nobody on it is still the base fee, not free.
assert.equal(payrollTotal(0, 0), 29);

// Every tier is priced and ordered cheapest first.
const prices = BOOKKEEPING_TIERS.map((t) => t.price);
assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
assert.ok(prices.every((p) => p > 0));

assert.equal(formatMoney(1234), "$1,234");

console.log("plans: all checks passed");
