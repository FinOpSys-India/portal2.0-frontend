/**
 * Customer portal boundary check. Run: npx tsx src/lib/customer.test.ts
 *
 * Focused on the rules that are easy to get silently wrong: workspace
 * isolation, and the service list that 1.0 gets flatly wrong.
 */
import assert from "node:assert/strict";

import { customerApi } from "./customer";

async function main() {
  const workspaces = await customerApi.workspaces();
  assert.ok(workspaces.length >= 2, "need 2+ workspaces to test isolation");

  const [harbor, lakeside] = workspaces;

  /* ------------------------------------------------- workspace isolation -- */

  // Data must be scoped per workspace. If these ever return the same rows, the
  // portal is showing one company's data under another company's name.
  const harborProjects = await customerApi.projects(harbor.id);
  const lakesideProjects = await customerApi.projects(lakeside.id);
  assert.notDeepEqual(harborProjects, lakesideProjects);

  const harborFiles = await customerApi.files(harbor.id);
  const lakesideFiles = await customerApi.files(lakeside.id);
  assert.notDeepEqual(harborFiles, lakesideFiles);

  const harborTeam = await customerApi.team(harbor.id);
  const lakesideTeam = await customerApi.team(lakeside.id);
  assert.ok(harborTeam.length > lakesideTeam.length);

  // An unknown workspace yields nothing rather than falling back to the first.
  assert.deepEqual(await customerApi.projects("does-not-exist"), []);
  assert.deepEqual(await customerApi.files("does-not-exist"), []);
  assert.deepEqual(await customerApi.availableServices("does-not-exist"), []);

  /* ---------------------------------------------------- service dropdown -- */

  // The bug this rewrite exists to fix: 1.0 offers only Payroll regardless of
  // what the company pays for. Every active service must be offerable.
  const harborServices = await customerApi.availableServices(harbor.id);
  assert.deepEqual(harborServices, ["Bookkeeping", "Payroll", "Taxes"]);

  const harborCompany = (await customerApi.companies()).find(
    (c) => c.id === harbor.id,
  );
  assert.ok(harborCompany);
  assert.deepEqual(
    harborServices,
    harborCompany.activeServices,
    "service options must match the company's active services",
  );

  // A single-service company offers exactly that one.
  assert.deepEqual(await customerApi.availableServices(lakeside.id), [
    "Payroll",
  ]);

  /* ------------------------------------------------- project detail scope -- */

  const first = harborProjects[0];
  const fetched = await customerApi.project(harbor.id, first.id);
  assert.deepEqual(fetched, first);

  // A project id from another workspace must NOT resolve, or the detail page
  // becomes a way to read another company's work by guessing an id.
  assert.equal(await customerApi.project(lakeside.id, first.id), null);
  assert.equal(await customerApi.project(harbor.id, "no-such-id"), null);

  // Files scoped to a project only return that project's files.
  const projectFiles = await customerApi.files(harbor.id, first.name);
  assert.ok(projectFiles.length > 0);
  assert.ok(projectFiles.every((f) => f.project === first.name));
  assert.ok(projectFiles.length < harborFiles.length);
  assert.deepEqual(await customerApi.files(harbor.id, "no-such-project"), []);

  /* ------------------------------------------------------------- create -- */

  const created = await customerApi.createProject(harbor.id, {
    name: "August payroll run",
    service: "Payroll",
    deadline: "2026-09-01",
  });
  assert.equal(created.name, "August payroll run");
  assert.equal(created.service, "Payroll");
  // A brand-new project cannot already be in progress or assigned.
  assert.equal(created.status, "Not started");
  assert.equal(created.specialist, null);

  /* ------------------------------------------------------------- upload -- */

  const file = new File(["x"], "august-invoice.pdf");
  const uploaded = await customerApi.uploadFile(harbor.id, file, {
    project: first.name,
  });
  assert.equal(uploaded.name, "august-invoice.pdf");
  assert.equal(uploaded.project, first.name);
  // It lands in this workspace's list, and only this one.
  assert.ok((await customerApi.files(harbor.id)).some((f) => f.id === uploaded.id));
  assert.ok(!(await customerApi.files(lakeside.id)).some((f) => f.id === uploaded.id));
  // A project from another workspace must not be a valid target, or the form
  // becomes a way to drop files into a company you do not belong to.
  await assert.rejects(() =>
    customerApi.uploadFile(lakeside.id, file, { project: first.name }),
  );

  /* ------------------------------------------------------------ profile -- */

  const profile = await customerApi.profile();
  assert.ok(profile.email.includes("@"));
  // Address starts empty — the customer fills it, and admin only reads it.
  assert.equal(profile.addressLine1, "");
  await customerApi.saveProfile({ ...profile, city: "Austin" });

  /* ------------------------------------------------------------ connect -- */

  // One counterparty, and it is a real person — the card is labelled with it.
  const thread = await customerApi.thread(harbor.id);
  assert.ok(thread.contact.length > 0);
  assert.equal((await customerApi.manager(harbor.id)).email.includes("@"), true);

  // A sent message lands on this workspace's thread and nowhere else. The two
  // threads sharing a store is how a customer reads the wrong company's chat.
  const sent = await customerApi.sendMessage(harbor.id, "Cutoff confirmed?");
  assert.equal(sent.mine, true);
  assert.ok((await customerApi.messages(harbor.id)).some((m) => m.id === sent.id));
  assert.ok(
    !(await customerApi.messages(lakeside.id)).some((m) => m.id === sent.id),
  );

  // Exactly once. The chat appends what send() returns to the list it already
  // holds, so a mock that hands back its live array shows every send twice.
  const after = await customerApi.messages(harbor.id);
  assert.equal(after.filter((m) => m.id === sent.id).length, 1);
  assert.equal(new Set(after.map((m) => m.id)).size, after.length);

  // An attachment is a message too, carrying files instead of a body. The list
  // is an array: the backend accepts several per message, and the old singular
  // field discarded every file past the first.
  const attached = await customerApi.sendAttachment(harbor.id, file);
  assert.equal(attached.attachments.length, 1);
  assert.equal(attached.attachments[0].name, "august-invoice.pdf");
  // The id is what the download link is minted from, so it must be present.
  assert.ok(Number.isFinite(attached.attachments[0].id));

  // An unknown workspace has no thread to write into.
  assert.deepEqual(await customerApi.messages("does-not-exist"), []);
  await assert.rejects(() => customerApi.sendMessage("does-not-exist", "hi"));

  console.log("customer api: all checks passed");
}

main();
