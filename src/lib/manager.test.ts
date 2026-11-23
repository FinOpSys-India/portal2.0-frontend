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
  dayLabel,
  messageTime,
  fileKind,
  formatFileSize,
  isOverdue,
  orderServices,
  parseDeadline,
  sameName,
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
    creatorId: null,
    inactive: false,
    previousProject: null,
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

/* ------------------------------------------------------- overdue tasks ---- */

// Tasks run the same rule as projects — same three states, same question.
assert.ok(isOverdue({ deadline: daysAway(-1), status: "Not started" }));
assert.ok(isOverdue({ deadline: daysAway(-14), status: "In progress" }));
// Due today is due, not late.
assert.ok(!isOverdue({ deadline: daysAway(0), status: "Not started" }));
// Done is never late, however long it sat there.
assert.ok(!isOverdue({ deadline: daysAway(-90), status: "Completed" }));
// An undated task is never late.
assert.ok(!isOverdue({ deadline: "", status: "In progress" }));

/* ------------------------------------------------------- service order ---- */

const opt = (serviceCode: string) => ({
  servicePlanId: 1,
  serviceName: serviceCode,
  serviceCode,
});

// The endpoint's own order is Bookkeeping, Tax, Payroll; every screen says
// Bookkeeping, Payroll, Tax.
assert.deepEqual(
  orderServices([opt("BOOKKEEPING"), opt("TAX"), opt("PAYROLL")]).map(
    (s) => s.serviceCode,
  ),
  ["BOOKKEEPING", "PAYROLL", "TAX"],
);
// A company on one service is not reordered into a gap.
assert.deepEqual(
  orderServices([opt("TAX")]).map((s) => s.serviceCode),
  ["TAX"],
);
// A service this app has never heard of lands last, and is never dropped.
assert.deepEqual(
  orderServices([opt("ADVISORY"), opt("TAX"), opt("BOOKKEEPING")]).map(
    (s) => s.serviceCode,
  ),
  ["BOOKKEEPING", "TAX", "ADVISORY"],
);

console.log("manager api: service order ok");

/* --------------------------------------------------- duplicate names ------ */

// What counts as the same name when a project or a task is created. The rule
// is what a reader would say, not what the column would say: typing a name
// back in lower case, or with the trailing space a copy-paste leaves behind,
// is the same name and must be refused.
assert.equal(sameName("August payroll", "august payroll"), true);
assert.equal(sameName("August payroll", "  August payroll  "), true);
assert.equal(sameName("August payroll", "AUGUST PAYROLL"), true);
// Different names stay different — including the ones a `contains` search
// returns alongside the real match, which is exactly what this comparison is
// there to sort out.
assert.equal(sameName("August payroll", "August payroll run"), false);
assert.equal(sameName("August payroll", "September payroll"), false);
// Inner spacing is part of the name; only the edges are trimmed.
assert.equal(sameName("August payroll", "Augustpayroll"), false);

console.log("manager api: duplicate names ok");
