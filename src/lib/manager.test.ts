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
  fileKind,
  formatFileSize,
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

// The trap: as strings, "8/05/26" < "7/15/26" is false but "1/9/27" sorts
// before both, so text comparison gets the ordering wrong. Dates fix it.
assert.ok(parseDeadline("7/15/26") < parseDeadline("8/05/26"));
assert.ok(parseDeadline("8/05/26") < parseDeadline("1/9/27"));
assert.ok(
  "1/9/27" < "7/15/26",
  "string ordering really is wrong here — this is why we parse",
);

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
assert.match(
  dayLabel(new Date(2026, 7, 11, 12, 0).toISOString(), now),
  /2026/,
  "older than yesterday falls back to a dated label",
);

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

// scoped() is what keeps a selection alive across navigation.
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

console.log("manager api: all checks passed");
