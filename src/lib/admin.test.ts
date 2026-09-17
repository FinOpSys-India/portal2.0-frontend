/**
 * Admin portal check. Run: npx tsx src/lib/admin.test.ts
 *
 * The risky part here is role resolution. `POST /invitations` takes numeric
 * ids, the invite forms speak display names, and a name that matches nothing
 * used to fall through to the catalog's first entry — so a mis-spelled label
 * created a person in the WRONG role and reported success. Nothing about the
 * response said otherwise, which is why it is worth a test rather than a read.
 *
 * The catalog below is `GET /roles` written out, not a stand-in for the app's
 * data: `resolveRoleIds` is pure, and the fetch that feeds it in production has
 * nothing to get subtly wrong.
 */
import assert from "node:assert/strict";

import { SPECIALIST_ROLES, serviceAmounts } from "./admin";
import type { Subscription, SubscriptionLine } from "./billing";
import { resolveRoleIds, type RoleCatalog } from "./directory";

const CATALOG: RoleCatalog[] = [
  { roleId: 1, code: "ADMIN", name: "Administrator", requiresSpecificRole: false, specificRoles: [] },
  {
    roleId: 2,
    code: "ACCOUNTING_MANAGER",
    name: "Accounting Manager",
    requiresSpecificRole: false,
    specificRoles: [],
  },
  {
    roleId: 3,
    code: "SPECIALIST",
    name: "Specialist",
    requiresSpecificRole: true,
    specificRoles: [
      { specificRoleId: 3, code: "SPECIALIST_1", name: "Payroll Specialist" },
      { specificRoleId: 4, code: "SPECIALIST_2", name: "Tax Specialist" },
      { specificRoleId: 5, code: "SPECIALIST_3", name: "Bookkeeping Specialist" },
      { specificRoleId: 6, code: "SPECIALIST_4", name: "FP&A Specialist" },
    ],
  },
  {
    roleId: 4,
    code: "CUSTOMER",
    name: "Customer",
    requiresSpecificRole: true,
    specificRoles: [
      { specificRoleId: 1, code: "OWNER", name: "Owner" },
      { specificRoleId: 2, code: "TEAM", name: "Team" },
    ],
  },
];

/* --------------------------------------------------- catalog agreement -- */

const specialist = CATALOG.find((r) => r.code === "SPECIALIST");
assert.ok(specialist, "the catalog has a SPECIALIST role");

// Every label the invite form offers must exist in the catalog. This is the
// check that fails if the seed renames a role — or if someone reintroduces
// 1.0's "Bookkeping".
for (const name of SPECIALIST_ROLES) {
  assert.ok(
    specialist.specificRoles.some((s) => s.name === name),
    `"${name}" is a real specific role`,
  );
}

/* ------------------------------------------------------- resolution ----- */

const bookkeeping = resolveRoleIds(CATALOG, "SPECIALIST", "Bookkeeping Specialist");
const payroll = resolveRoleIds(CATALOG, "SPECIALIST", "Payroll Specialist");

assert.equal(bookkeeping.roleId, specialist.roleId);
// The whole point: bookkeeping must not resolve to the first entry, which is
// exactly what the old fallback did.
assert.notEqual(bookkeeping.specificRoleId, payroll.specificRoleId);

// Codes resolve too — the customer invite sends "OWNER", not "Owner".
const owner = resolveRoleIds(CATALOG, "CUSTOMER", "OWNER");
const byName = resolveRoleIds(CATALOG, "CUSTOMER", "Owner");
assert.equal(owner.specificRoleId, byName.specificRoleId);

// A role with no subdivisions asks for none.
assert.deepEqual(resolveRoleIds(CATALOG, "ACCOUNTING_MANAGER", null), {
  roleId: 2,
  specificRoleId: null,
});

// Naming nothing on a role that demands a subdivision takes the catalog's own
// default rather than refusing — the invite dialogs that omit it rely on this.
assert.equal(
  resolveRoleIds(CATALOG, "CUSTOMER").specificRoleId,
  owner.specificRoleId,
);

/* ------------------------------------------------------------ refusal --- */

// An unknown label is an error rather than a silent wrong role.
assert.throws(
  () => resolveRoleIds(CATALOG, "SPECIALIST", "Bookkeping Specialist"),
  /Unknown SPECIALIST role/,
);
assert.throws(() => resolveRoleIds(CATALOG, "NOT_A_ROLE"), /Unknown role/);

/* ------------------------------------------------- current plan amounts -- */

/**
 * The Amount column read "—" on every company: the admin's company route
 * carries `activeServices`, which prices nothing, and the priced view belongs
 * to a route only an accounting manager may call. These amounts come from
 * `GET /billing/subscription` instead, which an admin may read on any company.
 */
function sub(lines: Partial<SubscriptionLine>[]): Subscription {
  return {
    status: "ACTIVE",
    currentPeriodStart: "2026-07-30T05:09:21.000Z",
    currentPeriodEnd: "2026-08-30T05:09:21.000Z",
    cancelAtPeriodEnd: false,
    currency: "USD",
    recurringTotalAmountMinor: 0,
    lines: lines.map((line) => ({
      service: null,
      component: "plan",
      planName: null,
      quantity: 1,
      unitAmountMinor: 0,
      totalAmountMinor: 0,
      currency: "USD",
      ...line,
    })),
  };
}

// One line, one service.
assert.equal(
  serviceAmounts(
    sub([{ service: "bookkeeping", planName: "Starter", totalAmountMinor: 9900 }]),
  ).get("BOOKKEEPING"),
  "$99/month",
);

// Payroll is THREE lines — base, W-2 employees, 1099 contractors — and the
// column shows one figure for the service. Reading only the base plan would
// under-report every payroll account by its head counts.
assert.equal(
  serviceAmounts(
    sub([
      { service: "payroll", component: "base", totalAmountMinor: 2900 },
      { service: "payroll", component: "employees", quantity: 2, totalAmountMinor: 4000 },
      { service: "payroll", component: "contractors", quantity: 2, totalAmountMinor: 2000 },
    ]),
  ).get("PAYROLL"),
  "$89/month",
);

// TAX on the company row, `taxes` in the billing catalog. Lowercasing the code
// would drop this line and leave the tax row reading "—" forever.
assert.equal(
  serviceAmounts(sub([{ service: "taxes", totalAmountMinor: 12500 }])).get("TAX"),
  "$125/month",
);

// Cents survive: `money` only drops them on a whole-dollar amount.
assert.equal(
  serviceAmounts(sub([{ service: "taxes", totalAmountMinor: 6350 }])).get("TAX"),
  "$63.50/month",
);

// A service with no line has no entry — the page prints "—" for it, which is
// "not subscribed", not "price missing".
assert.equal(
  serviceAmounts(sub([{ service: "bookkeeping", totalAmountMinor: 9900 }])).get("PAYROLL"),
  undefined,
);

// A line the catalog cannot name is dropped rather than summed into a
// neighbour's row.
assert.equal(serviceAmounts(sub([{ service: null, totalAmountMinor: 5000 }])).size, 0);

console.log("admin api: all checks passed");
