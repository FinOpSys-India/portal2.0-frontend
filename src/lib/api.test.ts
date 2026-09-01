/**
 * Smoke check for the auth boundary. Run: npx tsx src/lib/api.test.ts
 *
 * Covers the branching bits only — role routing and the checkout translation.
 * The fetch path is not exercised: every call in `api` is a request now, and a
 * test that stood a server up would be checking the backend rather than this.
 */
import assert from "node:assert/strict";

import { landingPathForRole, toSelectedServices } from "./api";
import { BOOKKEEPING_TIERS, TAX_TIERS } from "./plans";

// Every role lands somewhere distinct, and the routes are the 1.0 ones.
assert.equal(landingPathForRole("ADMIN"), "/list_of_customers");
assert.equal(landingPathForRole("CUSTOMER"), "/comany_select");
// NOT /comany_select. That picker lists the companies the caller OWNS, and a
// manager owns none — it landed them on an empty chooser with no way out.
assert.equal(landingPathForRole("ACCOUNTING_MANAGER"), "/manager");
assert.equal(landingPathForRole("SPECIALIST"), "/project");

// The checkout body. Every field here is one the backend's `rejectUnknown`
// would 400 on if it were named wrong, and none of it is exercised by a
// request in this file — the mapping is the whole risk, so it is asserted
// directly. Option ids, never plan codes: `BOOKKEEPING_STARTER` is a real
// string in the backend and still not one checkout accepts.
const full = toSelectedServices({
  companyId: 1,
  bookkeepingOptionId: BOOKKEEPING_TIERS[0].optionId,
  taxOptionId: TAX_TIERS[0].optionId,
  payroll: { employeeCount: 3, contractorCount: 2 },
});
assert.deepEqual(full, {
  bookkeeping: { selected: true, priceOptionId: "bookkeeping_option_1" },
  taxes: { selected: true, priceOptionId: "tax_option_1" },
  payroll: {
    selected: true,
    planId: "payroll_standard",
    employeeCount: 3,
    contractorCount: 2,
  },
});

// An unchosen service is OMITTED, not sent `selected: false`. Both are
// accepted, but a key that is present with a null option id is not.
const bookkeepingOnly = toSelectedServices({
  companyId: 1,
  bookkeepingOptionId: BOOKKEEPING_TIERS[3].optionId,
  taxOptionId: null,
  payroll: null,
});
assert.deepEqual(Object.keys(bookkeepingOnly), ["bookkeeping"]);
assert.equal(bookkeepingOnly.bookkeeping?.priceOptionId, "bookkeeping_option_4");

// Payroll at zero headcount is still a selection: the base fee is charged at
// quantity 1 regardless, so dropping it here would undercharge.
const payrollOnly = toSelectedServices({
  companyId: 1,
  bookkeepingOptionId: null,
  taxOptionId: null,
  payroll: { employeeCount: 0, contractorCount: 0 },
});
assert.deepEqual(Object.keys(payrollOnly), ["payroll"]);

// Every tier the plan step can offer must name an id the catalog knows.
for (const tier of BOOKKEEPING_TIERS) {
  assert.match(tier.optionId, /^bookkeeping_option_[1-4]$/);
}
for (const tier of TAX_TIERS) {
  assert.match(tier.optionId, /^tax_option_[1-3]$/);
}

console.log("auth api: all checks passed");
