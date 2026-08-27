/**
 * Smoke check for the auth boundary. Run: npx tsx src/lib/api.test.ts
 *
 * Covers the branching bits only — role routing and the mock's shapes. The
 * fetch path is not exercised: with no NEXT_PUBLIC_API_URL set the boundary
 * answers from its fixtures, which is exactly the branch under test here.
 *
 * The old version of this file asserted a contract that never existed: a
 * `userId` on the login challenge, lowercase role names, and an OTP verified
 * against an address. All three are gone — the backend answers with a
 * `challengeId`, spells roles in upper snake case, and resolves the user from
 * the challenge rather than from anything the client sends.
 */
import assert from "node:assert/strict";

import { api, landingPathForRole, toSelectedServices } from "./api";
import { BOOKKEEPING_TIERS, TAX_TIERS } from "./plans";

async function main() {
  // Every role lands somewhere distinct, and the routes are the 1.0 ones.
  assert.equal(landingPathForRole("ADMIN"), "/list_of_customers");
  assert.equal(landingPathForRole("CUSTOMER"), "/comany_select");
  // NOT /comany_select. That picker lists the companies the caller OWNS, and a
  // manager owns none — it landed them on an empty chooser with no way out.
  assert.equal(landingPathForRole("ACCOUNTING_MANAGER"), "/manager");
  assert.equal(landingPathForRole("SPECIALIST"), "/project");

  // login -> a challenge id the OTP screen spends, and a MASKED address it may
  // only display. The full address is deliberately not returned.
  const challenge = await api.login("testuser1_admin@finopsys.ai", "pw");
  assert.match(
    challenge.challengeId,
    /^[0-9a-f-]{36}$/,
    "challengeId must look like a UUID — it is what /auth/otp spends",
  );
  assert.ok(
    challenge.maskedEmail.includes("*"),
    "the address must come back masked",
  );
  assert.ok(!challenge.maskedEmail.includes("testuser1_admin"));

  // The server states its own resend cooldown rather than the client guessing.
  assert.ok(challenge.resendAvailableInSeconds > 0);

  // Verify returns a session whose role decides the landing route.
  const session = await api.verifyOtp(challenge.challengeId, "123456");
  assert.equal(session.role, session.user.role, "role mirrors the user's own");
  assert.equal(
    landingPathForRole(session.role),
    "/comany_select",
    "the fixture user is a CUSTOMER",
  );

  // Resend answers with the next cooldown, so the button can disable honestly.
  const resent = await api.resendOtp(challenge.challengeId);
  assert.ok(resent.resendAvailableInSeconds > 0);

  // Signing up completes an invitation and returns a live session — there is no
  // verify step on that path.
  const signedUp = await api.signup({
    invitationToken: "a".repeat(64),
    email: "invited@example.com",
    firstName: "In",
    lastName: "Vited",
    password: "Passw0rd!",
  });
  assert.ok(signedUp.user.email, "signup must answer with the created user");

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
  assert.equal(
    bookkeepingOnly.bookkeeping?.priceOptionId,
    "bookkeeping_option_4",
  );

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
}

main();
