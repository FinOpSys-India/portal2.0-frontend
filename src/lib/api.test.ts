/**
 * Smoke check for the auth boundary. Run: npx tsx src/lib/api.test.ts
 *
 * Covers the branching bits only — role routing and the checkout translation.
 * The fetch path is not exercised: every call in `api` is a request now, and a
 * test that stood a server up would be checking the backend rather than this.
 */
import assert from "node:assert/strict";

import {
  api,
  landingPathFor,
  landingPathForRole,
  toSelectedServices,
  unpaidCompanyIds,
} from "./api";
import { BOOKKEEPING_TIERS, TAX_TIERS } from "./plans";

// Every role lands somewhere distinct, and the routes are the 1.0 ones.
assert.equal(landingPathForRole("ADMIN"), "/list_of_customers");
assert.equal(landingPathForRole("CUSTOMER"), "/company_select");
// NOT /company_select. That picker lists the companies the caller OWNS, and a
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

// The plan step bills ONE company, and it is the one with no subscription.
// `GET /onboarding` answers per company now; this used to read a company's
// ACTIVE/ONBOARDING state off `/companies/owned`, which lagged the payment and
// could not say WHICH of several bills was outstanding.
const status = {
  isOwner: true,
  profileComplete: true,
  companyCreated: true,
  paymentComplete: false,
  complete: true,
  companies: [
    { id: 10, companyName: "zomato", paymentComplete: true },
    { id: 11, companyName: "Palentier", paymentComplete: false },
    { id: 5, companyName: "Swiggy", paymentComplete: true },
  ],
};

// Only the unpaid one, and as a string — a row id and a route param are strings
// everywhere they are compared against this.
assert.deepEqual(unpaidCompanyIds(status), ["11"]);

// Everything paid: nothing is tagged and nothing routes to checkout.
assert.deepEqual(
  unpaidCompanyIds({ ...status, paymentComplete: true, companies: [status.companies[0]] }),
  [],
);

// A deployment that predates the field, and a non-owner, both send no
// `companies` at all. Neither has a bill to show, so neither gets one.
assert.deepEqual(unpaidCompanyIds({ ...status, companies: undefined }), []);

/*
 * AN UNPAID COMPANY NO LONGER HIJACKS THE LOGIN.
 *
 * It used to: an owner with one company left as an unpaid draft was sent to its
 * plan step on every sign-in, which locked them out of the companies they HAD
 * paid for. The bill is a chip on that one row now, so login lands on the
 * portal and the picker routes.
 */
const session = {
  role: "CUSTOMER" as const,
  user: {
    id: 12,
    email: "shubham.gupta@finopsys.ai",
    firstName: "Shubham",
    lastName: "Gupta",
    role: "CUSTOMER" as const,
  },
};

// Timers aside, the last checks are async and this file compiles to CJS, which
// has no top-level await — same wrapper chat-realtime.test.ts uses.
void (async () => {
  // The one request `landingPathFor` makes, stubbed — the fetch path is not
  // what is under test here, the branching is.
  api.onboardingStatus = async () => status as never;
  assert.equal(await landingPathFor(session as never), "/company_select");

  // Still a wizard for the steps that ARE the owner's to finish: no profile,
  // and a profile with no company.
  api.onboardingStatus = async () =>
    ({ ...status, profileComplete: false, complete: false }) as never;
  assert.match(
    await landingPathFor(session as never),
    /^\/on_boarding_form_user_info\//,
  );

  api.onboardingStatus = async () =>
    ({ ...status, companyCreated: false, complete: false }) as never;
  assert.match(
    await landingPathFor(session as never),
    /^\/on_boarding_form_part_1\?/,
  );

  console.log("onboarding routing: all checks passed");
})();
