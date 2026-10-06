/**
 * The customer portal's row adapters. Run: npx tsx src/lib/customer.test.ts
 *
 * `toTeamRoster` is the one with a rule in it rather than a rename: which of two
 * titles a row shows depends on which side of the account the person is on, and
 * getting it backwards would print a specialist's career history where a
 * customer looks to find out who does their books.
 */
import assert from "node:assert/strict";

import { FINOPSYS, toTeamRoster } from "@/lib/customer";
import type { BackendCompany, BackendTeammate } from "@/lib/portal";

/* Shaped as `companyDto.toCompanyDetailWithTeam` builds it: every person through
 * `projectDto.toPerson`, the specialists grouped by `toTeam`. */
const COMPANY = {
  id: 12,
  companyName: "Northwind Trading",
  teamMembers: {
    owner: {
      id: 1,
      firstName: "Ada",
      lastName: "Byron",
      email: "ada@northwind.test",
      jobTitle: "Founder",
      avatarUrl: null,
    },
    accountingManager: {
      id: 2,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@finopsys.ai",
      // Deliberately set, and deliberately not what the row must show.
      jobTitle: "Senior Associate",
      avatarUrl: "https://cdn.test/grace.png",
    },
    specialists: [
      {
        id: 3,
        firstName: "Alan",
        lastName: "Turing",
        email: "alan@finopsys.ai",
        jobTitle: "Principal",
        avatarUrl: null,
        specializations: [
          { assignmentId: 9, specializationCode: "BOOKKEEPING", specializationName: "Bookkeeping" },
          { assignmentId: 10, specializationCode: "TAX", specializationName: "Tax" },
        ],
      },
      // Staffed on nothing the join resolved — still a person on the account.
      { id: 4, firstName: "Edsger", lastName: "Dijkstra", email: null, specializations: [] },
    ],
  },
} as unknown as BackendCompany;

const TEAMMATES: BackendTeammate[] = [
  {
    firstName: "Ivo",
    lastName: "Novak",
    jobTitle: "Office Manager",
    specificRoleName: "Team Member",
    email: "ivo@northwind.test",
    avatarUrl: null,
  },
  // No typed title: the catalog role is the only thing left to say.
  {
    firstName: "Mina",
    lastName: "Reyes",
    jobTitle: null,
    specificRoleName: "Team Member",
    email: "mina@northwind.test",
  },
];

const roster = toTeamRoster(COMPANY, TEAMMATES);

// Both sides, customer's people first.
assert.deepEqual(
  roster.map((r) => [r.name, r.title, r.company]),
  [
    ["Ada Byron", "Founder", "Northwind Trading"],
    ["Ivo Novak", "Office Manager", "Northwind Trading"],
    ["Mina Reyes", "Team Member", "Northwind Trading"],
    ["Grace Hopper", "Accounting Manager", FINOPSYS],
    ["Alan Turing", "Bookkeeping Specialist, Tax Specialist", FINOPSYS],
    ["Edsger Dijkstra", "Specialist", FINOPSYS],
  ],
);

// The row still carries what the table draws beside the name.
assert.deepEqual(roster[3], {
  name: "Grace Hopper",
  avatarUrl: "https://cdn.test/grace.png",
  title: "Accounting Manager",
  company: FINOPSYS,
  email: "grace@finopsys.ai",
});
assert.equal(roster[5].email, "");

// A company read that 404s leaves the teammate roster standing, with no company
// name to put beside them — the page's own reason to exist still renders.
assert.deepEqual(
  toTeamRoster(null, TEAMMATES).map((r) => [r.name, r.title, r.company]),
  [
    ["Ivo Novak", "Office Manager", ""],
    ["Mina Reyes", "Team Member", ""],
  ],
);

// `members`, the older spelling of the same block, is read too.
assert.deepEqual(
  toTeamRoster(
    { companyName: "Acme", members: { owner: null, accountingManager: null, specialists: [] } } as unknown as BackendCompany,
    [],
  ),
  [],
);

console.log("customer.ts OK");
