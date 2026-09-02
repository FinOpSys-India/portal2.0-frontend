/**
 * The backend-row adapters. Run: npx tsx src/lib/portal.test.ts
 *
 * These are the whole risk of the integration. Nothing in this repo issues a
 * request, so a field renamed on one side would surface as `undefined` in a
 * table cell and nowhere else. Asserted here against rows shaped exactly as the
 * DTOs in Portal-backend/src/dto build them.
 */
import assert from "node:assert/strict";

import {
  billingDate,
  personName,
  taskStatusCode,
  teamNames,
  toAddressFields,
  toChatMessage,
  toClientCompany,
  toManagedProject,
  toProjectStatus,
  toProjectTask,
  toSpecialistTask,
  toTaskStatus,
  money,
  type BackendCompany,
  type BackendProject,
  type BackendTask,
} from "./portal";

/* --------------------------------------------------------------- statuses -- */

// Three states, two vocabularies. Projects and tasks name them differently and
// always have — the map is the only place that knows both.
assert.equal(toProjectStatus("TODO"), "Not started");
assert.equal(toProjectStatus("ACTIVE"), "In progress");
assert.equal(toProjectStatus("COMPLETED"), "Completed");
assert.equal(toTaskStatus("TODO"), "To do");
assert.equal(toTaskStatus("ACTIVE"), "In progress");

// An unknown code must not render blank: a status cell with nothing in it reads
// as a data problem, and "Not started" is the column's own default.
assert.equal(toProjectStatus("SOMETHING_NEW"), "Not started");
assert.equal(toTaskStatus("SOMETHING_NEW"), "To do");

// And back. PATCH /tasks/:id/status takes the code, never the label — sending
// "In progress" is a 400 from the enum check.
assert.equal(taskStatusCode("To do"), "TODO");
assert.equal(taskStatusCode("In progress"), "ACTIVE");
assert.equal(taskStatusCode("Completed"), "COMPLETED");

// Round trip, every state.
for (const code of ["TODO", "ACTIVE", "COMPLETED"]) {
  assert.equal(taskStatusCode(toTaskStatus(code)), code);
}

/* ----------------------------------------------------------------- people -- */

assert.equal(personName({ firstName: "Maya", lastName: "Reyes" }), "Maya Reyes");
assert.equal(personName(null), "");
// An unassigned service line is null, not a missing key — the column renders a
// placeholder rather than the word "null".
assert.equal(personName(undefined), "");

/* --------------------------------------------------------------- projects -- */

const project: BackendProject = {
  id: 12,
  projectName: "Q3 Bookkeeping",
  deadlineDate: "2026-09-30",
  description: null,
  companyId: 18,
  companyName: "Harbor Coffee Roasters",
  service: {
    serviceName: "Bookkeeping",
    serviceCode: "BOOKKEEPING",
    servicePlanId: 4,
  },
  specialist: { firstName: "Nadia", lastName: "Haddad" },
  createdBy: { firstName: "Priya", lastName: "Nair" },
  status: "ACTIVE",
  progressBar: 40,
  createdAt: "2026-07-01T09:00:00.000Z",
};

const mapped = toManagedProject(project);
assert.equal(mapped.id, "12", "ids are strings on this side — they are route params");
assert.equal(mapped.companyId, "18");
assert.equal(mapped.name, "Q3 Bookkeeping");
// "Service Type" is the SPECIALIZATION, not the plan tier. Sending planName
// here would put "Starter" in a column that should read "Bookkeeping".
assert.equal(mapped.service, "Bookkeeping");
assert.equal(mapped.status, "In progress");
assert.equal(mapped.specialist, "Nadia Haddad");
assert.equal(mapped.progress, 40);

// An unstaffed line stays null so the column can say so, rather than "".
assert.equal(toManagedProject({ ...project, specialist: null }).specialist, null);

// A project with no deadline renders empty, never "null".
assert.equal(toManagedProject({ ...project, deadlineDate: null }).deadline, "");
assert.equal(toManagedProject({ ...project, service: null }).service, "");

/* ------------------------------------------------------------------ tasks -- */

const task: BackendTask = {
  id: 7,
  projectId: 12,
  project: { id: 12, projectName: "Q3 Bookkeeping" },
  companyId: 18,
  companyName: "Harbor Coffee Roasters",
  taskName: "Reconcile July",
  description: "Match the bank feed against the ledger.",
  status: "TODO",
  deadlineDate: "2026-08-15",
};

assert.deepEqual(toProjectTask(task), {
  id: "7",
  projectId: "12",
  name: "Reconcile July",
  description: "Match the bank feed against the ledger.",
  status: "To do",
  deadline: "2026-08-15",
});

// Across projects the task name alone says nothing, so the project rides along.
assert.equal(toSpecialistTask(task).project, "Q3 Bookkeeping");
assert.equal(toSpecialistTask({ ...task, project: null }).project, "");

/* ------------------------------------------------------------------- chat -- */

const message = {
  id: 91,
  conversationId: 3,
  sender: { firstName: "Alex", lastName: "Morgan" },
  body: "Payroll register is ready.",
  attachments: [],
  createdAt: "2026-08-20T10:00:00.000Z",
  mine: true,
};

assert.equal(toChatMessage(message).id, "91");
assert.equal(toChatMessage(message).mine, true);
assert.deepEqual(toChatMessage(message).attachments, []);

// An attachment-only message has a NULL body. Rendering that as "null" is the
// bug this guards; the composer wants an empty string and the file.
const withFile = toChatMessage({
  ...message,
  body: null,
  attachments: [{ id: 5, fileName: "register.pdf", sizeBytes: 2048 }],
});
assert.equal(withFile.body, "");
// The ID SURVIVES. It is the only handle on bytes that sit in a private bucket,
// and dropping it — which the singular shape did — made every attachment in the
// app unopenable.
assert.deepEqual(withFile.attachments, [
  { id: 5, name: "register.pdf", size: 2048 },
]);

// Several files on one message: the backend accepts them and the old shape
// silently kept only the first.
assert.equal(
  toChatMessage({
    ...message,
    attachments: [
      { id: 5, fileName: "a.pdf", sizeBytes: 1 },
      { id: 6, fileName: "b.pdf", sizeBytes: 2 },
    ],
  }).attachments.length,
  2,
);

/* -------------------------------------------------------------- companies -- */

const company: BackendCompany = {
  id: 18,
  companyName: "Harbor Coffee Roasters",
  companyEmail: "billing@harbor.example.com",
  owner: { firstName: "Priya", lastName: "Nair" },
  accountingManager: { firstName: "Alex", lastName: "Morgan" },
  primaryAddress: {
    addressLine1: "1 Dock St",
    city: "Austin",
    state: "TX",
    postalCode: "73301",
    country: "United States of America",
  },
  activeServices: [
    { specializationName: "Bookkeeping" },
    { specializationName: "Payroll" },
  ],
  billing: { currentPeriodEnd: "2026-09-06T00:00:00.000Z" },
  teamMembers: {
    owner: { firstName: "Priya", lastName: "Nair" },
    accountingManager: { firstName: "Alex", lastName: "Morgan" },
    specialists: [{ firstName: "Nadia", lastName: "Haddad" }],
  },
};

const account = toClientCompany(company);
assert.equal(account.id, "18");
assert.deepEqual(account.activeServices, ["Bookkeeping", "Payroll"]);
assert.deepEqual(account.teamMembers, ["Priya Nair", "Alex Morgan", "Nadia Haddad"]);
// Specialists alone — the Action cell names who is staffed, and the owner and
// the manager are not that.
assert.deepEqual(account.specialists, ["Nadia Haddad"]);

// No subscription is a REAL state — onboarded but never checked out. The cell
// reads blank; it must not invent a date.
assert.equal(billingDate({ ...company, billing: null }), null);
assert.ok(billingDate(company)?.includes("2026"));

// The manager's own view names the same block `members` rather than
// `teamMembers`. Both must produce the same roster.
assert.deepEqual(
  teamNames({ ...company, teamMembers: undefined, members: company.teamMembers }),
  ["Priya Nair", "Alex Morgan", "Nadia Haddad"],
);
// A company with nobody staffed is an empty list, never a crash.
assert.deepEqual(teamNames({ ...company, teamMembers: undefined }), []);

/* -------------------------------------------------------------- addresses -- */

// `postalCode` on the wire, `zip` on every form here.
//
// The street line is `addressLine1` on BOTH sides — this fixture used to say
// `line1`, matching the type rather than the payload, so the adapter and the
// test agreed with each other and disagreed with the server. The field rendered
// blank in every portal and nothing here failed.
assert.deepEqual(toAddressFields(company.primaryAddress), {
  addressLine1: "1 Dock St",
  city: "Austin",
  state: "TX",
  zip: "73301",
  country: "United States of America",
});

// Null until onboarding collects one, which is common — every key stays present
// so a form binds to strings rather than to undefined.
assert.deepEqual(toAddressFields(null), {
  addressLine1: "",
  city: "",
  state: "",
  zip: "",
  country: "",
});

/* ------------------------------------------------------------------ money -- */

// Minor units throughout the API. Dividing by 100 in a template would print
// "$2.49" for a $249 plan.
assert.equal(money(24900, "USD"), "$249");
assert.equal(money(12550, "USD"), "$125.50");

console.log("portal adapters: all checks passed");
