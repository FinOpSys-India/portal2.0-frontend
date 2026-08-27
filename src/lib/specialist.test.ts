/**
 * Specialist portal check. Run: npx tsx src/lib/specialist.test.ts
 *
 * The risky part here is scope. Every read is the manager's data narrowed to
 * one person, so a filter that silently falls back to the unfiltered set shows
 * one specialist another's work — and every id on these routes is guessable.
 */
import assert from "node:assert/strict";

import { managerApi, toStamp } from "./manager";
import { specialistApi } from "./specialist";

async function main() {
  /* ------------------------------------------------------------- identity -- */

  const me = await specialistApi.profile();
  assert.equal(me.email, "rosa.delgado@finopsys.ai");
  assert.ok(me.speciality.length > 0);

  const manager = await specialistApi.manager();
  assert.equal(manager.name, "Alex Morgan");

  /* --------------------------------------------------------------- scope --- */

  const everything = await managerApi.projects();
  const mine = await specialistApi.projects();

  assert.ok(mine.length > 1, "fixtures must span more than one project");
  assert.ok(
    mine.length < everything.length,
    "fixtures must include work that is not this specialist's",
  );
  assert.ok(mine.every((p) => p.specialist === me.name));

  // A project belonging to someone else reads as missing, not as forbidden:
  // distinguishing the two turns the id into a lookup oracle.
  const theirs = everything.find((p) => p.specialist !== me.name);
  assert.ok(theirs, "fixtures must include someone else's project");
  assert.equal(await specialistApi.project(theirs.id), null);
  assert.deepEqual(await specialistApi.tasks(theirs.id), []);

  assert.ok(await specialistApi.project(mine[0].id));

  // Unknown company yields nothing rather than falling back to everything.
  assert.deepEqual(await specialistApi.projects("does-not-exist"), []);

  const companies = await specialistApi.companies();
  assert.ok(companies.length > 1, "fixtures must span more than one company");
  // Derived from their projects, not from the manager's book: a company they
  // hold no work at has no business appearing in their switcher.
  const worked = new Set(mine.map((p) => p.companyId));
  assert.deepEqual(
    companies.map((c) => c.id).sort(),
    [...worked].sort(),
  );
  assert.equal(await specialistApi.company("does-not-exist"), null);

  const scopedProjects = await specialistApi.projects(companies[0].id);
  assert.ok(scopedProjects.length > 0);
  assert.ok(scopedProjects.every((p) => p.companyId === companies[0].id));

  /* ---------------------------------------------------------------- tasks -- */

  const tasks = await specialistApi.allTasks();
  assert.ok(tasks.length > 0, "fixtures must populate a task list");

  const names = new Set(mine.map((p) => p.name));
  assert.ok(
    tasks.every((t) => names.has(t.project)),
    "every task must sit on a project this specialist holds",
  );

  // Narrowing by company must narrow, using the project each task sits on.
  const narrowed = await specialistApi.allTasks(companies[0].id);
  const onCompany = new Set(scopedProjects.map((p) => p.name));
  assert.ok(narrowed.length > 0 && narrowed.length < tasks.length);
  assert.ok(narrowed.every((t) => onCompany.has(t.project)));

  // Adding a task must actually add it — a create that leaves the list
  // unchanged reads as a failure. The deadline arrives from a date input.
  const before = (await specialistApi.tasks(mine[0].id)).length;
  await specialistApi.addTask(mine[0].id, {
    name: "Check the check",
    description: "…",
    deadline: "2026-09-01",
  });
  const after = await specialistApi.tasks(mine[0].id);
  assert.equal(after.length, before + 1);

  const added = after[after.length - 1];
  assert.equal(added.status, "To do");
  // Stored in 1.0's format, not the input's, or it sorts and renders wrong.
  assert.equal(added.deadline, "9/01/26");

  await specialistApi.setTaskStatus(added.id, "Completed");
  const moved = (await specialistApi.tasks(mine[0].id)).find(
    (t) => t.id === added.id,
  );
  assert.equal(moved?.status, "Completed");

  /* ------------------------------------------------------------ documents -- */

  const docs = await specialistApi.documents();
  const theirCompanies = new Set(companies.map((c) => c.id));
  assert.ok(
    docs.every((d) => theirCompanies.has(d.companyId)),
    "files must never leak from a company this specialist does not work for",
  );

  // A company id off the URL is not a permission. Uploading against one they
  // do not work for has to fail, not land the file somewhere else.
  const file = { name: "notes.pdf", size: 1024 } as File;
  await assert.rejects(
    () => specialistApi.uploadDocument(file, { companyId: "harbor-x", project: null }),
    /not working for that company/i,
  );

  const uploaded = await specialistApi.uploadDocument(file, {
    companyId: companies[0].id,
    project: null,
  });
  assert.equal(uploaded.owner, me.name, "the uploader is the session, not a prop");
  assert.equal(uploaded.project, null);
  assert.ok(
    (await specialistApi.documents(companies[0].id)).some(
      (d) => d.id === uploaded.id,
    ),
  );

  /* ----------------------------------------------------------------- chat -- */

  const thread = await specialistApi.thread();
  assert.equal(thread.contact, manager.name);

  const messages = await specialistApi.messages();
  assert.ok(messages.length > 0);

  const sent = await specialistApi.sendMessage("Sending this.");
  assert.equal(sent.mine, true);
  assert.equal(
    (await specialistApi.messages()).at(-1)?.id,
    sent.id,
    "a sent message must land at the end of the thread",
  );

  /* ---------------------------------------------------------------- dates -- */

  assert.equal(toStamp("2026-09-01"), "9/01/26");
  // Month unpadded, day padded — matches every fixture.
  assert.equal(toStamp("2026-12-25"), "12/25/26");

  console.log("specialist api: all checks passed");
}

main();
