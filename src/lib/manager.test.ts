/**
 * Manager portal check. Run: npx tsx src/lib/manager.test.ts
 *
 * The date handling here is the risky part: deadlines are 1.0's M/DD/YY
 * strings, and comparing those as text quietly reports the wrong projects as
 * late.
 */
import assert from "node:assert/strict";

import {
  INBOXES,
  dayLabel,
  fileKind,
  formatFileSize,
  managerApi,

  parseDeadline,
  scoped,
  sortByUnreadThenRecent,
  totalUnread,
  unassigned,
  type Conversation,
  type ManagedProject,
} from "./manager";

function conversation(over: Partial<Conversation>): Conversation {
  return {
    id: "c",
    companyId: "harbor",
    company: "Harbor Coffee Roasters",
    contact: "Priya Nair",
    channel: "chat",
    party: "customer",
    lastMessage: "…",
    lastMessageAt: "8/01/26",
    unread: 0,
    ...over,
  };
}

function project(over: Partial<ManagedProject>): ManagedProject {
  return {
    id: "x",
    name: "Test",
    company: "Harbor Coffee Roasters",
    companyId: "harbor",
    service: "Payroll",
    deadline: "8/05/26",
    status: "Not started",
    specialist: null,
    createdBy: "Priya Nair",
    progress: 0,
    createdOn: "7/02/26",
    ...over,
  };
}

async function main() {
  /* ------------------------------------------------------ deadline parse -- */

  assert.deepEqual(parseDeadline("8/05/26"), new Date(2026, 7, 5));
  assert.deepEqual(parseDeadline("7/15/26"), new Date(2026, 6, 15));
  // Single-digit month and day.
  assert.deepEqual(parseDeadline("1/9/27"), new Date(2027, 0, 9));

  // The trap: as strings, "8/05/26" < "7/15/26" is false but "1/9/27" sorts
  // before both, so text comparison gets the ordering wrong. Dates fix it.
  assert.ok(parseDeadline("7/15/26") < parseDeadline("8/05/26"));
  assert.ok(parseDeadline("8/05/26") < parseDeadline("1/9/27"));
  assert.ok(
    "1/9/27" < "7/15/26",
    "string ordering really is wrong here — this is why we parse",
  );

  /* ----------------------------------------------------------- unassigned -- */

  const rows = [
    project({ id: "a", specialist: null }),
    project({ id: "b", specialist: "Rosa Delgado" }),
    project({ id: "c", specialist: null }),
  ];
  assert.deepEqual(
    unassigned(rows).map((p) => p.id),
    ["a", "c"],
  );

  /* ------------------------------------------------------------ api shape -- */

  const all = await managerApi.projects();
  assert.ok(all.length > 0);

  // Filtering by company must actually filter, and only to that company.
  const harbor = await managerApi.projects("harbor");
  assert.ok(harbor.length > 0 && harbor.length < all.length);
  assert.ok(harbor.every((p) => p.companyId === "harbor"));

  // Unknown company yields nothing rather than falling back to everything —
  // the failure mode that would show one client another client's work.
  assert.deepEqual(await managerApi.projects("does-not-exist"), []);

  // The queue is non-empty in fixtures, so the assign flow is exercised.
  assert.ok(unassigned(all).length > 0, "fixtures must include unassigned work");

  const specialists = await managerApi.specialists();
  assert.ok(specialists.length > 0);
  assert.ok(
    specialists.some((s) => s.activeProjects === 0),
    "need a free specialist to show the Free state",
  );

  const companies = await managerApi.companies();
  assert.ok(companies.length > 0);
  assert.equal(await managerApi.company("does-not-exist"), null);

  // Project detail resolves, and a bad id is null rather than a stray row.
  assert.deepEqual(await managerApi.project(all[0].id), all[0]);
  assert.equal(await managerApi.project("no-such-id"), null);

  await managerApi.assignSpecialist("p2", specialists[0].email);

  /* -------------------------------------------------------- conversations -- */

  // Unread first, then most recent. The date ordering is the trap: "8/03/26"
  // sorts after "7/28/26" as text but is the later date, and vice versa across
  // a year boundary.
  const threads = [
    conversation({ id: "old-unread", unread: 1, lastMessageAt: "7/28/26" }),
    conversation({ id: "read-recent", unread: 0, lastMessageAt: "8/14/26" }),
    conversation({ id: "new-unread", unread: 3, lastMessageAt: "8/12/26" }),
  ];
  assert.deepEqual(
    sortByUnreadThenRecent(threads).map((c) => c.id),
    ["new-unread", "old-unread", "read-recent"],
    "unread threads come first, newest within each group",
  );

  // Sorting must not mutate the input.
  assert.equal(threads[0].id, "old-unread");

  assert.equal(totalUnread(threads), 4);
  assert.equal(totalUnread([]), 0);

  const allThreads = await managerApi.conversations();
  assert.ok(allThreads.length > 0);
  assert.ok(totalUnread(allThreads) > 0, "fixtures must have unread messages");
  // Already sorted by the API, so the first row is the one owing a reply.
  assert.ok(allThreads[0].unread > 0);

  const harborThreads = await managerApi.conversations({ companyId: "harbor" });
  assert.ok(harborThreads.every((c) => c.companyId === "harbor"));
  assert.ok(harborThreads.length < allThreads.length);
  assert.deepEqual(
    await managerApi.conversations({ companyId: "does-not-exist" }),
    [],
  );

  /* ----------------------------------------------------------- chat days -- */

  // Whole days, not 24-hour spans: 11pm last night is "Yesterday" at 7am.
  const now = new Date(2026, 7, 19, 7, 0);
  assert.equal(dayLabel(new Date(2026, 7, 19, 6, 59).toISOString(), now), "Today");
  assert.equal(
    dayLabel(new Date(2026, 7, 18, 23, 30).toISOString(), now),
    "Yesterday",
  );
  assert.equal(
    dayLabel(new Date(2026, 7, 19, 23, 59).toISOString(), now),
    "Today",
    "later today is still today, not tomorrow",
  );
  assert.match(
    dayLabel(new Date(2026, 7, 11, 12, 0).toISOString(), now),
    /2026/,
    "older than yesterday falls back to a dated label",
  );

  // Threads must arrive oldest-first, or the dividers group the wrong days.
  const thread = await managerApi.messages("c1");
  assert.ok(thread.length > 1);
  assert.ok(
    thread.every(
      (m, i) =>
        i === 0 ||
        new Date(thread[i - 1].sentAt) <= new Date(m.sentAt),
    ),
    "messages must be in send order",
  );

  const sent = await managerApi.sendMessage("c1", "on it");
  assert.ok(sent.mine);
  assert.equal(dayLabel(sent.sentAt), "Today");
  assert.deepEqual((await managerApi.messages("c1")).at(-1), sent);
  assert.deepEqual(await managerApi.messages("no-such-thread"), []);

  /* ----------------------------------------------------------- file size -- */

  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(204_800), "200 KB");
  // Whole megabytes drop the pointless ".0"; fractional ones keep one digit.
  assert.equal(formatFileSize(12_582_912), "12 MB");
  assert.equal(formatFileSize(1_887_437), "1.8 MB");
  // The boundary: 1023 KB stays KB, 1024 becomes 1 MB.
  assert.equal(formatFileSize(1024 * 1023), "1023 KB");
  assert.equal(formatFileSize(1024 * 1024), "1 MB");

  assert.equal(fileKind("payroll-register-july.xlsx"), "XLSX");
  assert.equal(fileKind("archive.tar.gz"), "GZ");
  // A dotfile is not an extension — ".gitignore" is the whole name.
  assert.equal(fileKind(".gitignore"), "FILE");
  assert.equal(fileKind("README"), "FILE");

  /* ------------------------------------------------- project file filter -- */

  const byProject = await managerApi.documents(undefined, "July payroll run");
  assert.ok(byProject.length > 0);
  assert.ok(byProject.every((d) => d.project === "July payroll run"));
  // Both filters at once must intersect, not fall back to either alone.
  assert.deepEqual(
    await managerApi.documents("vertex", "July payroll run"),
    [],
  );

  /* ------------------------------------------------------- four inboxes -- */

  // Every combination must be reachable and mutually exclusive.
  assert.equal(INBOXES.length, 4);

  let covered = 0;
  for (const inbox of INBOXES) {
    const rows = await managerApi.conversations({
      channel: inbox.channel,
      party: inbox.party,
    });
    assert.ok(
      rows.length > 0,
      `fixtures must populate ${inbox.label}, or the tab renders empty`,
    );
    assert.ok(
      rows.every(
        (c) => c.channel === inbox.channel && c.party === inbox.party,
      ),
      `${inbox.label} leaked a conversation from another inbox`,
    );
    covered += rows.length;
  }
  // The four inboxes partition the set: nothing missing, nothing double-counted.
  assert.equal(covered, allThreads.length);

  // Filters compose: inbox plus company.
  const harborChatCustomers = await managerApi.conversations({
    companyId: "harbor",
    channel: "chat",
    party: "customer",
  });
  assert.ok(
    harborChatCustomers.every(
      (c) =>
        c.companyId === "harbor" &&
        c.channel === "chat" &&
        c.party === "customer",
    ),
  );

  /* ------------------------------------------------------------ documents -- */

  const docs = await managerApi.documents();
  assert.ok(docs.length > 0);

  // Newest upload first.
  for (let i = 1; i < docs.length; i += 1) {
    assert.ok(
      parseDeadline(docs[i - 1].uploadedAt) >= parseDeadline(docs[i].uploadedAt),
      "documents must be newest-first",
    );
  }

  const harborDocs = await managerApi.documents("harbor");
  assert.ok(harborDocs.every((d) => d.companyId === "harbor"));
  assert.ok(harborDocs.length < docs.length);
  assert.deepEqual(await managerApi.documents("does-not-exist"), []);

  // A document with no project must survive — files arrive before projects do.
  assert.ok(
    docs.some((d) => d.project === null),
    "fixtures must include an unattached document",
  );

  /* ------------------------------------------------------------ customers -- */

  const everyone = await managerApi.customers();
  assert.ok(everyone.length > 0);

  // Scoped by the header switcher, same contract as projects and documents.
  const harborCustomers = await managerApi.customers("harbor");
  assert.ok(harborCustomers.every((c) => c.companyIds.includes("harbor")));
  assert.deepEqual(await managerApi.customers("does-not-exist"), []);

  // A customer on two companies must appear under both, not just the first.
  const shared = everyone.find((c) => c.companyIds.length > 1);
  assert.ok(shared, "fixtures must include a multi-company customer");
  for (const id of shared.companyIds) {
    const scoped = await managerApi.customers(id);
    assert.ok(
      scoped.some((c) => c.email === shared.email),
      `multi-company customer missing from ${id}`,
    );
  }

  assert.equal((await managerApi.customer(everyone[0].email))?.name,
    everyone[0].name);
  assert.equal(await managerApi.customer("nobody@example.com"), null);

  /* ---------------------------------------------------------------- tasks -- */

  const tasks = await managerApi.tasks("p1");
  assert.ok(tasks.length > 0, "fixtures must populate a task list");
  assert.ok(tasks.every((t) => t.projectId === "p1"));
  // A project with no tasks renders the empty state rather than another
  // project's rows.
  assert.deepEqual(await managerApi.tasks("p2"), []);

  /* ------------------------------------------- company detail for the port -- */

  const harborDetail = await managerApi.company("harbor");
  assert.ok(harborDetail);
  assert.ok(harborDetail.plans.length > 0);
  // The manager is a team member on every company it manages, as 1.0 lists it.
  assert.ok(
    companies.every((c) => c.teamMembers.includes("Alex Morgan")),
    "manager must appear in every Team Members cell",
  );
  // Blank billing date is a real state — 1.0 renders the cell empty.
  assert.ok(
    companies.some((c) => c.billingDate === null),
    "fixtures must include a company with no billing date",
  );

  /* -------------------------------------------------------------- projects -- */

  // Progress drives a bar; out-of-range values would render past the track.
  assert.ok(all.every((p) => p.progress >= 0 && p.progress <= 100));
  assert.ok(all.every((p) => p.createdBy.length > 0));

  /* ------------------------------------------------------ company scoping -- */

  // A specialist belongs to no company, so scoping goes through project
  // assignment. Everyone returned must actually be on that company's work.
  const harborSpecialists = await managerApi.specialists("harbor");
  const harborProjects = await managerApi.projects("harbor");
  const onHarbor = new Set(harborProjects.map((p) => p.specialist));
  assert.ok(harborSpecialists.length > 0);
  assert.ok(harborSpecialists.every((s) => onHarbor.has(s.name)));
  assert.ok(
    harborSpecialists.length < (await managerApi.specialists()).length,
    "scoping must actually narrow, or the switcher does nothing here",
  );
  // Unassigned work must not drag its whole roster in.
  assert.deepEqual(await managerApi.specialists("does-not-exist"), []);

  // scoped() is what keeps a selection alive across navigation.
  assert.equal(scoped("/manager/projects"), "/manager/projects");
  assert.equal(scoped("/manager/projects", ""), "/manager/projects");
  assert.equal(
    scoped("/manager/projects", "harbor"),
    "/manager/projects?company=harbor",
  );
  // Ids reach the URL encoded, or one with a space or & truncates the query.
  assert.equal(
    scoped("/manager/projects", "a b&c"),
    "/manager/projects?company=a%20b%26c",
  );

  console.log("manager api: all checks passed");
}

main();
