/**
 * Admin portal check. Run: npx tsx src/lib/admin.test.ts
 *
 * The risky part here is role resolution. `POST /invitations` takes numeric
 * ids, the invite forms speak display names, and a name that matches nothing
 * used to fall through to the catalog's first entry — so a mis-spelled label
 * created a person in the WRONG role and reported success. Nothing about the
 * response said otherwise, which is why it is worth a test rather than a read.
 */
import assert from "node:assert/strict";

import { SPECIALIST_ROLES } from "./admin";
import { roleIds, roles } from "./directory";

async function main() {
  /* --------------------------------------------------- catalog agreement -- */

  const catalog = await roles();
  const specialist = catalog.find((r) => r.code === "SPECIALIST");
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

  const bookkeeping = await roleIds("SPECIALIST", "Bookkeeping Specialist");
  const payroll = await roleIds("SPECIALIST", "Payroll Specialist");

  assert.equal(bookkeeping.roleId, specialist.roleId);
  // The whole point: bookkeeping must not resolve to the first entry, which is
  // exactly what the old fallback did.
  assert.notEqual(bookkeeping.specificRoleId, payroll.specificRoleId);

  // Codes resolve too — the customer invite sends "OWNER", not "Owner".
  const owner = await roleIds("CUSTOMER", "OWNER");
  const byName = await roleIds("CUSTOMER", "Owner");
  assert.equal(owner.specificRoleId, byName.specificRoleId);

  // A role with no subdivisions asks for none.
  assert.deepEqual(await roleIds("ACCOUNTING_MANAGER", null), {
    roleId: 2,
    specificRoleId: null,
  });

  /* ------------------------------------------------------------ refusal --- */

  // An unknown label is now an error rather than a silent wrong role.
  await assert.rejects(
    () => roleIds("SPECIALIST", "Bookkeping Specialist"),
    /Unknown SPECIALIST role/,
  );
  await assert.rejects(() => roleIds("NOT_A_ROLE"), /Unknown role/);

  console.log("admin api: all checks passed");
}

main();
