/**
 * Manager portal check. Run: npx tsx src/lib/manager.test.ts
 *
 * The date handling here is the risky part: deadlines are 1.0's M/DD/YY
 * strings, and comparing those as text quietly reports the wrong projects as
 * late. Everything asserted below is a pure helper — the boundary functions
 * beside them are requests, and a test of those would be a test of the backend.
 */
import assert from "node:assert/strict";

import {
  INBOXES,
  MAX_EMAIL_ATTACHMENTS,
  acceptAttachments,
  dayLabel,
  messageTime,
  fileKind,
  formatFileSize,
  isOverdue,
  parseDeadline,
  scoped,
  scopeSwitch,
  sortByUnreadThenRecent,
  totalUnread,
  unassigned,
  unreadConversations,
  type Conversation,
  type ManagedProject,
} from "./manager";

function conversation(over: Partial<Conversation>): Conversation {
  return {
    id: "c",
    companyId: "c1",
    company: "A Company",
    contact: "A Person",
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
    company: "A Company",
    companyId: "c1",
    specialistAvatarUrl: null,
    service: "Payroll",
    deadline: "8/05/26",
    status: "Not started",
    specialist: null,
    createdBy: "A Person",
    progress: 0,
    createdOn: "7/02/26",
    ...over,
  };
}

/* -------------------------------------------------------- deadline parse -- */

assert.deepEqual(parseDeadline("8/05/26"), new Date(2026, 7, 5));
assert.deepEqual(parseDeadline("7/15/26"), new Date(2026, 6, 15));
// Single-digit month and day.
assert.deepEqual(parseDeadline("1/9/27"), new Date(2027, 0, 9));
assert.deepEqual(parseDeadline("9/30/2026"), new Date(2026, 8, 30));

// The trap: as strings, "8/05/26" < "7/15/26" is false but "1/9/27" sorts
// before both, so text comparison gets the ordering wrong. Dates fix it.
assert.ok(parseDeadline("7/15/26") < parseDeadline("8/05/26"));
assert.ok(parseDeadline("8/05/26") < parseDeadline("1/9/27"));
assert.ok(
  "1/9/27" < "7/15/26",
  "string ordering really is wrong here — this is why we parse",
);

// ISO, which is what the BACKEND sends — `deadlineDate` leaves projectDto.js as
// "YYYY-MM-DD". Only the 1.0 mocks speak M/DD/YY. Parsing one and not the other
// returned Invalid Date for every real row, which made `getTime()` NaN: the
// deadline column sorted into no order at all, and every date filter compared
// against NaN and threw the whole table away.
assert.deepEqual(parseDeadline("2026-09-15"), new Date(2026, 8, 15));
assert.deepEqual(parseDeadline("2026-09-08"), new Date(2026, 8, 8));
assert.ok(!Number.isNaN(parseDeadline("2026-09-15").getTime()));

// Both formats have to order against each other — a mocked list and a live one
// are never mixed, but the comparison is the same code either way.
assert.ok(parseDeadline("2026-09-08") < parseDeadline("2026-09-15"));

// Nothing to parse stays unparseable rather than becoming the epoch: a project
// with no deadline must not sort as 1 January 1970 or match "before 2027".
assert.ok(Number.isNaN(parseDeadline("").getTime()));

/* ------------------------------------------------------------- overdue -- */

// Relative to the day the test runs — a hard-coded date would start failing on
// its own deadline, which is a funny way to learn this helper still works.
function daysAway(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

assert.ok(isOverdue(project({ deadline: daysAway(-1), status: "In progress" })));
assert.ok(isOverdue(project({ deadline: daysAway(-90), status: "Not started" })));

// Due today is DUE, not late: a deadline is a calendar day, and the whole of it
// belongs to the project. Off by one here flags every project on its own
// deadline morning.
assert.ok(!isOverdue(project({ deadline: daysAway(0), status: "In progress" })));
assert.ok(!isOverdue(project({ deadline: daysAway(1), status: "In progress" })));

// Finished late is still finished — there is nothing for the flag to ask for.
assert.ok(!isOverdue(project({ deadline: daysAway(-30), status: "Completed" })));

// No deadline is not a missed one. NaN loses every comparison, which is why
// this needs no branch of its own — assert it so nobody "fixes" that away.
assert.ok(!isOverdue(project({ deadline: "", status: "In progress" })));

/* ------------------------------------------------------------ unassigned -- */

const rows = [
  project({ id: "a", specialist: null }),
  project({ id: "b", specialist: "Someone" }),
  project({ id: "c", specialist: null }),
];
assert.deepEqual(
  unassigned(rows).map((p) => p.id),
  ["a", "c"],
);

/* --------------------------------------------------------- conversations -- */

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

// The bell's destination. ISO instants, which is what `conversations()` carries
// — the most recently written UNREAD thread wins, not the most recent thread.
const live = [
  conversation({ id: "unread-older", unread: 1, lastMessageAt: "2026-08-12T09:00:00.000Z" }),
  conversation({ id: "read-newest", unread: 0, lastMessageAt: "2026-08-30T09:00:00.000Z" }),
  conversation({ id: "unread-newest", unread: 5, lastMessageAt: "2026-08-14T09:00:00.000Z" }),
];
assert.deepEqual(
  unreadConversations(live).map((c) => c.id),
  ["unread-newest", "unread-older"],
  "read threads are not notifications, and the newest unread leads",
);
assert.equal(live[0].id, "unread-older", "listing must not reorder the input");
assert.deepEqual(
  unreadConversations(live.map((c) => ({ ...c, unread: 0 }))),
  [],
  "nothing unread means an empty list, not a stale one",
);
assert.deepEqual(unreadConversations([]), []);

/* ------------------------------------------------------------- chat days -- */

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
assert.equal(
  dayLabel(new Date(2026, 7, 11, 12, 0).toISOString(), now),
  "8/11/2026",
  "older than yesterday falls back to a US-worded date, whatever the reader's locale",
);
assert.equal(messageTime(new Date(2026, 7, 19, 15, 42).toISOString()), "3:42 PM");

/* ------------------------------------------------------------- file size -- */

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

/* ---------------------------------------------------------- four inboxes -- */

// Every combination must be reachable and mutually exclusive.
assert.equal(INBOXES.length, 4);
assert.equal(
  new Set(INBOXES.map((i) => `${i.channel}:${i.party}`)).size,
  4,
  "the four inboxes must name four distinct channel/party pairs",
);

/* -------------------------------------------------------- company scope -- */

// scoped() is what keeps a selection alive across navigation — including out
// of a list and into a row's detail page, which is where dropping it answered
// 404: a specialist read under the company in view is not on the roster of
// whichever company the URL falls back to.
assert.equal(scoped("/manager/projects"), "/manager/projects");
assert.equal(scoped("/manager/projects", ""), "/manager/projects");
assert.equal(
  scoped("/manager/projects", "18"),
  "/manager/projects?company=18",
);
// Ids reach the URL encoded, or one with a space or & truncates the query.
assert.equal(
  scoped("/manager/projects", "a b&c"),
  "/manager/projects?company=a%20b%26c",
);

/* ---------------------------------------------------- email attachments -- */

const MB = 1024 * 1024;
const file = (name: string, mb: number) => ({ name, size: mb * MB });

// The happy path: two legal files land in order.
assert.deepEqual(
  acceptAttachments([], [file("a.pdf", 1), file("b.png", 2)]).files.map(
    (f) => f.name,
  ),
  ["a.pdf", "b.png"],
);

// A type the server's allowlist does not carry is refused, and — the part that
// matters — the rest of the same pick still arrives.
const mixed = acceptAttachments([], [file("virus.exe", 1), file("ok.pdf", 1)]);
assert.deepEqual(mixed.files.map((f) => f.name), ["ok.pdf"]);
assert.equal(mixed.refused.length, 1);
assert.match(mixed.refused[0], /virus\.exe/);

// Per-file cap: 25 MB. Enforced before anything is uploaded.
assert.equal(acceptAttachments([], [file("big.pdf", 26)]).files.length, 0);

// Total cap: 20 MB, and it is a property of the SET — each of these is legal
// on its own, and the third is what pushes the message over.
const total = acceptAttachments(
  [],
  [file("a.pdf", 9), file("b.pdf", 9), file("c.pdf", 9)],
);
assert.deepEqual(total.files.map((f) => f.name), ["a.pdf", "b.pdf"]);
assert.equal(total.refused.length, 1);

// The cap counts what is ALREADY attached, not just the new pick.
assert.equal(
  acceptAttachments([file("already.pdf", 19)], [file("more.pdf", 2)]).files
    .length,
  1,
);

// Count cap, with small files that no size rule would catch.
const many = acceptAttachments(
  [],
  Array.from({ length: MAX_EMAIL_ATTACHMENTS + 3 }, (_, i) =>
    file(`f${i}.txt`, 0),
  ),
);
assert.equal(many.files.length, MAX_EMAIL_ATTACHMENTS);
assert.equal(many.refused.length, 1, "one message about the count, not three");

// The same file picked twice is a no-op, not a refusal — otherwise re-dropping
// a folder would fill the alert with complaints about files already attached.
const twice = acceptAttachments([file("a.pdf", 1)], [file("a.pdf", 1)]);
assert.equal(twice.files.length, 1);
assert.deepEqual(twice.refused, []);

// Same name, different bytes: a genuinely different file, so both are kept.
assert.equal(
  acceptAttachments([file("a.pdf", 1)], [file("a.pdf", 2)]).files.length,
  2,
);

/*
 * Scope against record. The redirect these drive is the one thing standing
 * between the header switcher and one company's data under another's name, and
 * the branch that returns null is load-bearing in the other direction: an
 * address returned unconditionally is a redirect loop.
 */
const projectSwitch = (picked?: string) =>
  scopeSwitch({
    picked,
    owners: ["c1"],
    stay: "/manager/projects/p1",
    leave: (to) => scoped("/manager/projects", to),
  });

// They agree. Nothing to do, and this is every ordinary render.
assert.equal(projectSwitch("c1"), null);

// The switcher moved off this record: its list, under the new company.
assert.equal(projectSwitch("c2"), "/manager/projects?company=c2");

// A bare link pulls the scope onto the record rather than defaulting to the
// first company on the book.
assert.equal(projectSwitch(undefined), "/manager/projects/p1?company=c1");

// And what it returns then must itself agree, or the redirect repeats forever.
assert.equal(projectSwitch("c1"), null);

// A record on several companies is at home under any of them.
const customerSwitch = (picked?: string) =>
  scopeSwitch({
    picked,
    owners: ["c1", "c2"],
    stay: "/manager/customers/a%40b.com",
    leave: (to) => scoped("/manager/customers", to),
  });
assert.equal(customerSwitch("c2"), null);
assert.equal(customerSwitch("c3"), "/manager/customers?company=c3");
assert.equal(customerSwitch(undefined), "/manager/customers/a%40b.com?company=c1");

// No company came back for the record at all. Sending the reader to an address
// identical to the one they are on would loop; staying put is the only answer.
assert.equal(
  scopeSwitch({
    picked: undefined,
    owners: [undefined],
    stay: "/manager/projects/p1",
    leave: (to) => scoped("/manager/projects", to),
  }),
  null,
);

console.log("manager api: all checks passed");
