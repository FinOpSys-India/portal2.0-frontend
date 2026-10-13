/**
 * The words on a billing row.
 *
 * The service and the plan arrive as two backend strings that repeat each other
 * — "payroll" beside "Payroll Base" — and the table has a column for each, so
 * what is stripped and what is kept is worth pinning down.
 */
import assert from "node:assert/strict";

import { planLabel, serviceLabel, type SubscriptionLine } from "./billing";

const line = (over: Partial<SubscriptionLine>): SubscriptionLine => ({
  service: "payroll",
  component: "plan",
  planName: null,
  quantity: 1,
  unitAmountMinor: 1000,
  totalAmountMinor: 1000,
  currency: "usd",
  ...over,
});

// The billing key is not the word on screen: every other page says "Tax".
assert.equal(serviceLabel(line({ service: "taxes" })), "Tax");
assert.equal(serviceLabel(line({ service: "bookkeeping" })), "Bookkeeping");
// A service this app has never heard of still prints.
assert.equal(serviceLabel(line({ service: "advisory" })), "advisory");
assert.equal(serviceLabel(line({ service: null })), "Service");

// Payroll's three lines are told apart by their component, not by their name.
assert.equal(
  planLabel(line({ component: "base", planName: "Payroll Base" })),
  "Base",
);
assert.equal(
  planLabel(line({ component: "employees", planName: "Payroll Base" })),
  "W-2 Employees",
);

// The service is the column to the left, so it comes off the front of the plan.
assert.equal(
  planLabel(line({ service: "taxes", planName: "Tax - $500K to $2M Revenue" })),
  "$500K – $2M revenue",
);
// Stripping must not empty the cell: a plan named only for its service keeps it.
assert.equal(planLabel(line({ service: "payroll", planName: "Payroll" })), "Payroll");
// A plan that does not repeat the service is left alone.
assert.equal(
  planLabel(line({ service: "bookkeeping", planName: "Starter" })),
  "Starter",
);
assert.equal(planLabel(line({ planName: null })), "—");

console.log("billing labels: all checks passed");
