/**
 * The meetings boundary. Run: npx tsx src/lib/meetings.test.ts
 *
 * Rows are shaped like `meetingService.toDto` on Pratibha's dev13 branch, which
 * is what `GET /meetings?companyId=` returns per meeting. Everything here is a
 * pure function: the parts of meetings that can be wrong without erroring.
 */
import assert from "node:assert/strict";

import { ApiError } from "./http";
import { previewText } from "./meeting-note";
import {
  counterpart,
  dayGroups,
  formatWhen,
  zoneName,
  groupMeetings,
  httpsOnly,
  meetingLabel,
  meetingNote,
  meetingStart,
  noteFits,
  noteTarget,
  occurrences,
  parseMeetingNote,
  settleMeetings,
  toMeeting,
  type Meeting,
} from "./meetings";

const AM = { id: 21, name: "Pratibha Yadav", email: "pyadav@finopsys.ai" };
const CUSTOMER = {
  id: 22,
  name: "Shivam Gupta",
  email: "shivamgupta.codes@gmail.com",
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    companyId: 18,
    title: "Need help with GST",
    description: "Q3 filing questions",
    startAt: "2026-12-30T09:30:00.000Z",
    endAt: "2026-12-30T10:00:00.000Z",
    durationMinutes: 30,
    timezone: "Asia/Kolkata",
    isRecurring: false,
    recurrence: null,
    status: "REQUESTED",
    meetingLink: null,
    provider: "OTHER",
    organizer: AM,
    createdBy: CUSTOMER,
    participants: [
      {
        ...CUSTOMER,
        response: "ACCEPTED",
        respondedAt: "2026-11-17T12:03:45.159Z",
      },
    ],
    cancelledAt: null,
    cancelReason: null,
    createdAt: "2026-11-17T12:03:44.861Z",
    updatedAt: "2026-11-17T12:03:44.861Z",
    canEdit: true,
    canCancel: true,
    ...overrides,
  } as unknown as Parameters<typeof toMeeting>[0];
}

const meeting = (overrides: Record<string, unknown> = {}) =>
  toMeeting(row(overrides), "Northwind Traders");

/* ------------------------------------------------------------- mapping -- */

const m = meeting();
assert.equal(m.id, "12");
assert.equal(m.companyId, "18");
assert.equal(m.companyName, "Northwind Traders");
assert.equal(m.organizer.userId, 21, "person() sends `id`, the UI reads userId");
assert.equal(m.createdBy.userId, 22);
assert.equal(m.canRespond, false, "absent until the respond call ships");
assert.equal(m.description, "Q3 filing questions");
assert.equal(meeting({ description: null }).description, "");
assert.equal(meeting({ cancelReason: null }).cancelReason, "");
assert.equal(meeting({ canRespond: true }).canRespond, true);
assert.equal(
  meeting({ meetingLink: "javascript:alert(1)" }).joinUrl,
  null,
  "a link that is not https never becomes the Join link",
);
assert.equal(
  meeting({
    status: "SCHEDULED",
    provider: "TEAMS",
    meetingLink: "https://teams.microsoft.com/l/meetup-join/x",
  }).joinUrl,
  "https://teams.microsoft.com/l/meetup-join/x",
);
assert.equal(meeting({ provider: "TEAMS" }).teams, true);

/* ------------------------------------------------------------ httpsOnly -- */

assert.equal(
  httpsOnly("https://teams.microsoft.com/l/x"),
  "https://teams.microsoft.com/l/x",
);
assert.equal(httpsOnly("javascript:alert(1)"), null);
assert.equal(httpsOnly("http://zoom.us/j/1"), null);
assert.equal(httpsOnly("not a url"), null);
assert.equal(httpsOnly(null), null);
assert.equal(httpsOnly(undefined), null);

/* -------------------------------------------------------- groupMeetings -- */

const request = meeting({ id: 1, status: "REQUESTED", canEdit: true });
const later = meeting({
  id: 2,
  status: "SCHEDULED",
  startAt: "2026-12-02T10:00:00.000Z",
});
const sooner = meeting({
  id: 3,
  status: "SCHEDULED",
  startAt: "2026-11-25T10:00:00.000Z",
});
const done = meeting({
  id: 4,
  status: "COMPLETED",
  startAt: "2026-11-10T10:00:00.000Z",
});
const dropped = meeting({
  id: 5,
  status: "CANCELLED",
  startAt: "2026-11-19T10:00:00.000Z",
});

const forManager = groupMeetings(
  [later, done, request, sooner, dropped],
  "manager",
);
assert.deepEqual(
  forManager.needsReply.map((x) => x.id),
  ["1"],
  "a request the manager may accept waits on them",
);
assert.deepEqual(
  forManager.upcoming.map((x) => x.id),
  ["3", "2"],
  "upcoming is soonest first",
);
assert.deepEqual(
  forManager.past.map((x) => x.id),
  ["5", "4"],
  "past is newest first",
);

const invitation = meeting({ id: 6, status: "SCHEDULED", canRespond: true });
const ownRequest = meeting({
  id: 7,
  status: "REQUESTED",
  canEdit: false,
  canRespond: false,
});
const forCustomer = groupMeetings([invitation, ownRequest], "customer");
assert.deepEqual(forCustomer.needsReply.map((x) => x.id), ["6"]);
assert.deepEqual(
  forCustomer.upcoming.map((x) => x.id),
  ["7"],
  "the customer's own request waits on the manager, not on them",
);

/* ------------------------------------------------------------ dayGroups -- */

const lateEvening = meeting({
  startAt: "2026-11-24T19:30:00.000Z",
  endAt: "2026-11-24T20:00:00.000Z",
});
assert.equal(
  dayGroups([lateEvening], "Asia/Kolkata")[0].key,
  "2026-11-25",
  "01:00 IST is the next day in India",
);
assert.equal(dayGroups([lateEvening], "UTC")[0].key, "2026-11-24");
assert.equal(dayGroups([lateEvening], "Asia/Kolkata")[0].label, "Wed, Nov 25");
assert.deepEqual(dayGroups([], "UTC"), []);

const twoDays = dayGroups([later, sooner, later], "UTC");
assert.deepEqual(
  twoDays.map((g) => [g.key, g.meetings.length]),
  [
    ["2026-12-02", 2],
    ["2026-11-25", 1],
  ],
  "groups keep the order the list arrived in",
);

/* ----------------------------------------------------------- formatWhen -- */

assert.equal(
  formatWhen(
    "2026-11-24T08:30:00.000Z",
    "2026-11-24T09:00:00.000Z",
    "Asia/Kolkata",
  ),
  "Tue, Nov 24, 2026 · 2:00 – 2:30 PM IST",
  "an Indian reader sees IST, the name they know",
);
assert.equal(
  formatWhen(
    "2026-11-24T08:30:00.000Z",
    "2026-11-24T09:00:00.000Z",
    "America/New_York",
  ),
  "Tue, Nov 24, 2026 · 3:30 – 4:00 AM EST",
  "a US reader sees the same instant in their own time",
);
assert.equal(zoneName(new Date("2026-11-24T08:30:00Z"), "Asia/Dubai"), "GST");
assert.equal(zoneName(new Date("2026-11-24T08:30:00Z"), "Europe/London"), "GMT");
assert.equal(
  formatWhen("2026-11-24T05:30:00.000Z", "2026-11-24T07:00:00.000Z", "UTC"),
  "Tue, Nov 24, 2026 · 5:30 – 7:00 AM UTC",
);
assert.equal(
  formatWhen("2026-11-24T11:30:00.000Z", "2026-11-24T13:00:00.000Z", "UTC"),
  "Tue, Nov 24, 2026 · 11:30 AM – 1:00 PM UTC",
  "a range across noon names both halves of the day",
);

/* ----------------------------------------------------------- occurrences -- */

const weekly = meeting({
  startAt: "2026-11-20T04:30:00.000Z",
  endAt: "2026-11-20T05:00:00.000Z",
  isRecurring: true,
  recurrence: { frequency: "WEEKLY", interval: 1, count: 4, endDate: null },
});
assert.deepEqual(
  occurrences(
    weekly,
    new Date("2026-11-26T00:00:00Z"),
    new Date("2026-12-10T00:00:00Z"),
  ).map((o) => o.startAt.toISOString()),
  ["2026-11-27T04:30:00.000Z", "2026-12-04T04:30:00.000Z"],
);
assert.deepEqual(
  occurrences(
    weekly,
    new Date("2026-12-20T00:00:00Z"),
    new Date("2026-12-31T00:00:00Z"),
  ),
  [],
  "count ends the series: no fifth week",
);

const oneOff = meeting({
  startAt: "2026-11-24T08:30:00.000Z",
  endAt: "2026-11-24T09:00:00.000Z",
});
assert.equal(
  occurrences(
    oneOff,
    new Date("2026-11-23T00:00:00Z"),
    new Date("2026-11-30T00:00:00Z"),
  ).length,
  1,
);
assert.deepEqual(
  occurrences(
    oneOff,
    new Date("2026-11-25T00:00:00Z"),
    new Date("2026-11-30T00:00:00Z"),
  ),
  [],
);

const monthly = meeting({
  startAt: "2027-01-31T04:30:00.000Z",
  endAt: "2027-01-31T05:00:00.000Z",
  isRecurring: true,
  recurrence: { frequency: "MONTHLY", interval: 1, count: 3, endDate: null },
});
assert.deepEqual(
  occurrences(
    monthly,
    new Date("2027-02-01T00:00:00Z"),
    new Date("2027-03-01T00:00:00Z"),
  ).map((o) => o.startAt.toISOString()),
  ["2027-02-28T04:30:00.000Z"],
  "Jan 31 monthly lands on the last day of February",
);

const daily = meeting({
  startAt: "2026-11-25T04:30:00.000Z",
  endAt: "2026-11-25T05:00:00.000Z",
  isRecurring: true,
  recurrence: {
    frequency: "DAILY",
    interval: 2,
    count: null,
    endDate: "2026-11-29",
  },
});
assert.deepEqual(
  occurrences(
    daily,
    new Date("2026-11-01T00:00:00Z"),
    new Date("2026-12-31T00:00:00Z"),
  ).map((o) => o.startAt.toISOString().slice(0, 10)),
  ["2026-11-25", "2026-11-27", "2026-11-29"],
  "endDate is inclusive",
);

/* ----------------------------------------------------------- chat notes -- */

const note = meetingNote(m, "requested", "Asia/Kolkata");
const parsed = parseMeetingNote(note);
assert.ok(parsed, "a note this module wrote parses back");
assert.equal(parsed.meetingId, "12");
assert.equal(parsed.event, "requested");
assert.ok(!parsed.text.includes("[[meeting"), "the marker is not shown");
assert.ok(parsed.text.startsWith("Meeting requested: Need help with GST"));

const declined = meetingNote(m, "declined", "Asia/Kolkata", "Out of office");
assert.ok(declined.includes("Out of office"));
assert.ok(declined.includes("Need help with GST"));
assert.equal(parseMeetingNote(declined)?.event, "declined");

assert.equal(
  parseMeetingNote("hello [[meeting:abc]]"),
  null,
  "a lookalike typed by a person stays text",
);
assert.equal(parseMeetingNote("[[meeting:12:exploded]]"), null);
assert.equal(parseMeetingNote("[[meeting:12:requested]] and more"), null);
assert.equal(parseMeetingNote("plain text"), null);
assert.equal(parseMeetingNote(""), null);

// The inbox and the bell show the readable line, never the marker.
assert.equal(previewText(note), parsed.text);
assert.ok(!previewText(declined).includes("[[meeting"));
assert.equal(previewText("see you at 3"), "see you at 3");

/* -------------------------------------------------- who the note goes to -- */

assert.equal(counterpart(m).userId, 22, "the customer who asked");
const scheduledByAm = meeting({
  createdBy: AM,
  participants: [{ ...CUSTOMER, response: "PENDING", respondedAt: null }],
});
assert.equal(counterpart(scheduledByAm).userId, 22, "the customer invited");

assert.deepEqual(noteTarget(m, "manager"), {
  as: "manager",
  companyId: "18",
  userId: 22,
});
assert.deepEqual(noteTarget(m, "customer"), {
  as: "customer",
  workspace: "18",
});

/* ---------------------------------------------------------- meetingLabel -- */

assert.equal(meetingLabel(meeting({ status: "REQUESTED" }), "manager"), "Reply Needed");
assert.equal(
  meetingLabel(meeting({ status: "REQUESTED", canEdit: false }), "customer"),
  "Requested",
);
assert.equal(meetingLabel(meeting({ status: "SCHEDULED" }), "manager"), "Scheduled");
assert.equal(
  meetingLabel(meeting({ status: "SCHEDULED", canRespond: true }), "customer"),
  "Reply Needed",
);
assert.equal(
  meetingLabel(
    meeting({
      status: "SCHEDULED",
      createdBy: AM,
      participants: [{ ...CUSTOMER, response: "DECLINED", respondedAt: null }],
    }),
    "manager",
  ),
  "Declined",
  "the customer said no; the meeting stands until the manager cancels it",
);
assert.equal(meetingLabel(meeting({ status: "CANCELLED" }), "customer"), "Canceled");
assert.equal(meetingLabel(meeting({ status: "COMPLETED" }), "manager"), "Completed");

/* ------------------------------------------ a request whose time has gone -- */

const now = new Date("2026-11-23T12:00:00.000Z");
const lapsed = meeting({
  id: 30,
  status: "REQUESTED",
  canEdit: true,
  startAt: "2026-11-20T05:00:00.000Z",
  endAt: "2026-11-20T05:30:00.000Z",
});
const stillOpen = meeting({
  id: 31,
  status: "REQUESTED",
  canEdit: true,
  startAt: "2026-11-25T05:00:00.000Z",
  endAt: "2026-11-25T05:30:00.000Z",
});
const started = meeting({
  id: 32,
  status: "REQUESTED",
  canEdit: true,
  startAt: "2026-11-23T11:45:00.000Z",
  endAt: "2026-11-23T12:15:00.000Z",
});
assert.equal(
  meetingLabel(started, "manager", now),
  "Expired",
  "Accept is open until the meeting starts, not until it ends",
);
const lateInvite = meeting({
  id: 33,
  status: "SCHEDULED",
  canRespond: true,
  startAt: "2026-11-23T11:45:00.000Z",
  endAt: "2026-11-23T12:15:00.000Z",
});
assert.deepEqual(
  groupMeetings([lateInvite], "customer", now).needsReply,
  [],
  "an invitation that has started no longer asks for an answer",
);
assert.equal(meetingLabel(lateInvite, "customer", now), "Scheduled");

const lapsedGroups = groupMeetings([lapsed, stillOpen], "manager", now);
assert.deepEqual(
  lapsedGroups.needsReply.map((x) => x.id),
  ["31"],
  "a request whose time has passed no longer waits on anyone",
);
assert.deepEqual(lapsedGroups.past.map((x) => x.id), ["30"]);
assert.equal(meetingLabel(lapsed, "manager", now), "Expired");
assert.equal(meetingLabel(stillOpen, "manager", now), "Reply Needed");

/* ------------------------------------------- does a note fit its meeting? -- */

const live = meeting({ status: "SCHEDULED" });
const gone = meeting({ status: "CANCELLED" });
const asked = meeting({ status: "REQUESTED" });
const turnedDown = meeting({
  status: "SCHEDULED",
  createdBy: AM,
  participants: [{ ...CUSTOMER, response: "DECLINED", respondedAt: null }],
});
assert.equal(noteFits(gone, "canceled"), true);
assert.equal(
  noteFits(live, "canceled"),
  false,
  "a typed 'canceled' marker on a live meeting is not a cancellation",
);
assert.equal(noteFits(gone, "withdrawn"), true);
assert.equal(noteFits(live, "withdrawn"), false);
assert.equal(noteFits(live, "accepted"), true);
assert.equal(noteFits(asked, "accepted"), false);
assert.equal(noteFits(gone, "declined"), true, "the manager declined a request");
assert.equal(noteFits(turnedDown, "declined"), true, "the customer declined an invitation");
assert.equal(noteFits(live, "declined"), false);
assert.equal(noteFits(asked, "requested"), true);

/* ------------------------------------------------------- when it starts -- */

assert.equal(
  meetingStart("2026-11-24", "23:30", { startAt: "2026-11-25T04:30:00.000Z" }),
  "2026-11-25T04:30:00.000Z",
  "a picked slot is sent as its own instant, whatever day the reader's calendar shows",
);
assert.equal(
  meetingStart("2026-11-24", "14:00", null),
  new Date(2026, 10, 24, 14, 0).toISOString(),
  "a typed time is the reader's own wall-clock time on the picked day",
);

/* -------------------------------------------------------- settleMeetings -- */

const ok = (value: Meeting[]): PromiseSettledResult<Meeting[]> => ({
  status: "fulfilled",
  value,
});
const refused = (reason: unknown): PromiseSettledResult<Meeting[]> => ({
  status: "rejected",
  reason,
});
const notDeployed = new ApiError("Route not found", 404, "NOT_FOUND");

assert.deepEqual(
  settleMeetings([ok([m]), refused(new ApiError("Pay first", 402))]),
  { meetings: [m], unavailable: false },
  "one unpaid company does not empty the page",
);
assert.deepEqual(settleMeetings([refused(notDeployed), refused(notDeployed)]), {
  meetings: [],
  unavailable: true,
});
assert.deepEqual(settleMeetings([ok([]), refused(notDeployed)]), {
  meetings: [],
  unavailable: false,
});
assert.deepEqual(settleMeetings([]), { meetings: [], unavailable: false });

console.log("meetings: ok");
