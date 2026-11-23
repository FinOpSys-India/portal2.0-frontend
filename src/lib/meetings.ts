import { ApiError, get, patch, post, del } from "@/lib/http";
import { customerApi } from "@/lib/customer";
import { managerApi } from "@/lib/manager";
import type { MeetingEvent } from "@/lib/meeting-note";

/**
 * Meetings between a company's accounting manager and its customer team.
 *
 * Backed by Pratibha's scheduler (`/meetings`, `/integrations/microsoft`), read
 * off branch dev13/pratibha at 5870d17. Every meeting route takes
 * `?companyId=`, and the API answers who may do what on each row (`canEdit`,
 * `canCancel`, and `canRespond` once the reply call ships), so the screens show
 * a button because the server said so, never because of the role alone.
 *
 * Behind `NEXT_PUBLIC_MEETINGS=on` until the backend is live where the portal
 * runs: see `meetingsEnabled`.
 */

export type MeetingStatus = "REQUESTED" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type MeetingResponse = "PENDING" | "ACCEPTED" | "DECLINED";

export interface MeetingPerson {
  userId: number;
  name: string;
  email: string;
}

export interface Recurrence {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  count: number | null;
  /** YYYY-MM-DD, inclusive. */
  endDate: string | null;
}

export interface Meeting {
  id: string;
  companyId: string;
  /** Filled by the manager's cross-company read; "" on a one-company read. */
  companyName: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  timezone: string;
  status: MeetingStatus;
  /** The meeting link, only when it is https. The API sends it only while SCHEDULED. */
  joinUrl: string | null;
  teams: boolean;
  organizer: MeetingPerson;
  createdBy: MeetingPerson;
  participants: (MeetingPerson & { response: MeetingResponse })[];
  recurrence: Recurrence | null;
  cancelReason: string;
  canEdit: boolean;
  canCancel: boolean;
  canRespond: boolean;
}

interface BackendPerson {
  id: number;
  name: string | null;
  email: string;
}

export interface BackendMeeting {
  id: number;
  companyId: number;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  timezone: string;
  isRecurring: boolean;
  recurrence: Recurrence | null;
  status: MeetingStatus;
  meetingLink: string | null;
  provider: string;
  organizer: BackendPerson;
  createdBy: BackendPerson;
  participants: (BackendPerson & { response: MeetingResponse })[];
  cancelReason: string | null;
  canEdit: boolean;
  canCancel: boolean;
  /** Proposed in backend list #13; absent until it ships. */
  canRespond?: boolean;
}

/**
 * The flag. `NEXT_PUBLIC_` because the shells that draw the icon are client
 * components, so the value has to be baked into the bundle at build time.
 */
export function meetingsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MEETINGS === "on";
}

/** The URL itself when it parses as https, else null. Nothing else becomes a Join link. */
export function httpsOnly(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const toPerson = (p: BackendPerson): MeetingPerson => ({
  userId: p.id,
  name: p.name ?? p.email,
  email: p.email,
});

export function toMeeting(row: BackendMeeting, companyName = ""): Meeting {
  return {
    id: String(row.id),
    companyId: String(row.companyId),
    companyName,
    title: row.title,
    description: row.description ?? "",
    startAt: row.startAt,
    endAt: row.endAt,
    durationMinutes: row.durationMinutes,
    timezone: row.timezone,
    status: row.status,
    joinUrl: httpsOnly(row.meetingLink),
    teams: row.provider === "TEAMS",
    organizer: toPerson(row.organizer),
    createdBy: toPerson(row.createdBy),
    participants: row.participants.map((p) => ({
      ...toPerson(p),
      response: p.response,
    })),
    recurrence: row.isRecurring ? row.recurrence : null,
    cancelReason: row.cancelReason ?? "",
    canEdit: row.canEdit,
    canCancel: row.canCancel,
    canRespond: row.canRespond ?? false,
  };
}

const byStart = (a: Meeting, b: Meeting) => a.startAt.localeCompare(b.startAt);

/**
 * The page's three piles. "Needs reply" is what waits on THIS reader: for the
 * manager a request they can accept, for the customer an invitation they can
 * answer. Their own request waits on the other side, so it stays in upcoming.
 */
export function groupMeetings(
  list: Meeting[],
  viewer: "manager" | "customer",
  now: Date = new Date(),
): { needsReply: Meeting[]; upcoming: Meeting[]; past: Meeting[] } {
  const open = (m: Meeting) =>
    m.status === "SCHEDULED" || (m.status === "REQUESTED" && !lapsed(m, now));
  const waits = (m: Meeting) =>
    open(m) &&
    (viewer === "manager"
      ? m.status === "REQUESTED" && m.canEdit
      : m.canRespond && answerable(m, now));

  return {
    needsReply: list.filter(waits).sort(byStart),
    upcoming: list.filter((m) => open(m) && !waits(m)).sort(byStart),
    past: list.filter((m) => !open(m)).sort((a, b) => byStart(b, a)),
  };
}

/**
 * Runs of meetings on the same day, in the READER's time zone. Order is the
 * order given: the caller sorts, so a past list stays newest first.
 */
export function dayGroups(
  list: Meeting[],
  timeZone: string,
): { key: string; label: string; meetings: Meeting[] }[] {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const groups: { key: string; label: string; meetings: Meeting[] }[] = [];
  for (const m of list) {
    const when = new Date(m.startAt);
    const k = key.format(when);
    const group = groups.find((g) => g.key === k);
    if (group) group.meetings.push(m);
    else groups.push({ key: k, label: label.format(when), meetings: [m] });
  }
  return groups;
}

/**
 * The short name a reader knows for their zone at that instant: IST, EST, PST,
 * GST, GMT, UTC. US English names the American zones but only offers
 * "GMT+5:30" for India, so other English locales are tried for a real name
 * before falling back to the offset.
 */
export function zoneName(at: Date, timeZone: string): string {
  let fallback = "";
  for (const locale of ["en-US", "en-IN", "en-GB"]) {
    const name =
      new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    if (!/^GMT[+-]/.test(name)) return name;
    fallback ||= name;
  }
  return fallback;
}

/**
 * The zone in words, for a line like "Times are in India Standard Time".
 * Browsers report India as the legacy id "Asia/Calcutta"; nobody should read
 * an id.
 */
export function zoneLongName(timeZone: string, at: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? timeZone
  );
}

/** "2:00 PM", or "2:00 PM IST" with the zone. */
export function formatClock(iso: string, timeZone: string, withZone = false): string {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
  return withZone ? `${time} ${zoneName(at, timeZone)}` : time;
}

/**
 * "Tue, Nov 24, 2026 · 2:00 – 2:30 PM IST". The zone is always named:
 * the manager and the customer may not share one, and a chat note is read by
 * both.
 */
export function formatWhen(
  startAt: string,
  endAt: string,
  timeZone: string,
): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(startAt));

  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  const parts = (iso: string) => {
    const p = clock.formatToParts(new Date(iso));
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      p.find((x) => x.type === type)?.value ?? "";
    return {
      time: `${pick("hour")}:${pick("minute")}`,
      half: pick("dayPeriod"),
    };
  };
  const s = parts(startAt);
  const e = parts(endAt);
  const range =
    s.half === e.half
      ? `${s.time} – ${e.time} ${e.half}`
      : `${s.time} ${s.half} – ${e.time} ${e.half}`;
  return `${day} · ${range} ${zoneName(new Date(endAt), timeZone)}`;
}

/* ----------------------------------------------------------- recurrence -- */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Start of the k-th occurrence. The same rules as the backend's
 * utils/meetingRecurrence.js: steps in UTC, MONTHLY keeps the day of the month
 * and clamps it to the month's last day.
 */
function occurrenceStart(start: Date, rule: Recurrence, k: number): Date {
  if (rule.frequency === "DAILY")
    return new Date(start.getTime() + k * rule.interval * DAY_MS);
  if (rule.frequency === "WEEKLY")
    return new Date(start.getTime() + k * rule.interval * 7 * DAY_MS);
  const months = start.getUTCMonth() + k * rule.interval;
  const year = start.getUTCFullYear() + Math.floor(months / 12);
  const month = ((months % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = new Date(start);
  d.setUTCFullYear(year, month, Math.min(start.getUTCDate(), last));
  return d;
}

function occurrenceCount(start: Date, rule: Recurrence): number {
  if (rule.count) return rule.count;
  if (!rule.endDate) return 1;
  const [y, mo, d] = rule.endDate.split("-").map(Number);
  const limit = Date.UTC(y, mo - 1, d + 1);
  let n = 0;
  while (occurrenceStart(start, rule, n).getTime() < limit) n += 1;
  return n;
}

/** Every occurrence that overlaps [from, to). A one-off is its own single occurrence. */
export function occurrences(
  m: Meeting,
  from: Date,
  to: Date,
): { startAt: Date; endAt: Date }[] {
  const start = new Date(m.startAt);
  const length = new Date(m.endAt).getTime() - start.getTime();
  const rule = m.recurrence;
  const n = rule ? occurrenceCount(start, rule) : 1;

  const out: { startAt: Date; endAt: Date }[] = [];
  for (let k = 0; k < n; k += 1) {
    const s = rule ? occurrenceStart(start, rule, k) : start;
    if (s >= to) break;
    const e = new Date(s.getTime() + length);
    if (e > from) out.push({ startAt: s, endAt: e });
  }
  return out;
}

/* ------------------------------------------------------------ chat notes -- */

export { parseMeetingNote, type MeetingEvent } from "@/lib/meeting-note";

const EVENT_LINE: Record<MeetingEvent, string> = {
  scheduled: "Meeting scheduled",
  requested: "Meeting requested",
  accepted: "Meeting accepted",
  declined: "Meeting declined",
  canceled: "Meeting canceled",
  withdrawn: "Request withdrawn",
};

/**
 * The chat message a meeting event leaves. A readable line first, so a thread
 * opened anywhere the card is not drawn still says what happened, then a
 * marker the thread swaps for a live card.
 *
 * ponytail: the marker rides in an ordinary message because the backend posts
 * nothing to chat. A server-side system message replaces it (backend list #13).
 */
export function meetingNote(
  m: Meeting,
  event: MeetingEvent,
  timeZone: string,
  reason?: string,
): string {
  const why = reason?.trim() ? ` · Reason: ${reason.trim()}` : "";
  return `${EVENT_LINE[event]}: ${m.title} · ${formatWhen(m.startAt, m.endAt, timeZone)}${why} [[meeting:${m.id}:${event}]]`;
}

/** The customer-side person on a meeting: who asked, or who was invited. */
export function counterpart(m: Meeting): MeetingPerson {
  if (m.createdBy.userId !== m.organizer.userId) return m.createdBy;
  return (
    m.participants.find((p) => p.userId !== m.organizer.userId) ?? m.createdBy
  );
}

/**
 * A request nobody accepted before its start time (Siddharth, 23 Nov: Accept
 * stays until the meeting starts). The backend never expires one and would
 * still accept it; the screens treat it as history (backend list #13 asks the
 * API to refuse it too).
 */
export function lapsed(m: Meeting, now: Date = new Date()): boolean {
  return m.status === "REQUESTED" && new Date(m.startAt) <= now;
}

/** Can this reader still answer this meeting? Only until it starts. */
export function answerable(m: Meeting, now: Date = new Date()): boolean {
  return new Date(m.startAt) > now;
}

export type MeetingLabel =
  | "Expired"
  | "Reply Needed"
  | "Requested"
  | "Scheduled"
  | "Declined"
  | "Canceled"
  | "Completed";

/**
 * The status a row shows. Not the API's status word: "Reply Needed" is a
 * request or invitation that waits on THIS reader, and "Declined" is a
 * scheduled meeting the customer said no to, which stands until the manager
 * cancels it.
 */
export function meetingLabel(
  m: Meeting,
  viewer: "manager" | "customer",
  now: Date = new Date(),
): MeetingLabel {
  if (m.status === "CANCELLED") return "Canceled";
  if (m.status === "COMPLETED") return "Completed";
  if (lapsed(m, now)) return "Expired";
  if (m.status === "REQUESTED")
    return viewer === "manager" && m.canEdit ? "Reply Needed" : "Requested";
  const customer = m.participants.find(
    (p) => p.userId === counterpart(m).userId,
  );
  if (customer?.response === "DECLINED") return "Declined";
  return viewer === "customer" && m.canRespond && answerable(m, now)
    ? "Reply Needed"
    : "Scheduled";
}

/**
 * Does what a note says match what the API now says about its meeting? A
 * status line ("Maya canceled …") is drawn only when it does, so a person who
 * types a marker into chat cannot make a live meeting look canceled.
 */
export function noteFits(m: Meeting, event: MeetingEvent): boolean {
  switch (event) {
    case "scheduled":
    case "requested":
      return true;
    case "accepted":
      return m.status === "SCHEDULED" || m.status === "COMPLETED";
    case "declined":
      return (
        m.status === "CANCELLED" ||
        m.participants.some(
          (p) => p.userId === counterpart(m).userId && p.response === "DECLINED",
        )
      );
    case "canceled":
    case "withdrawn":
      return m.status === "CANCELLED";
  }
}

/**
 * The instant a new meeting starts. A picked slot is sent as its own instant:
 * the slots are the manager's working day in the office's zone, which is not
 * always the day the reader's calendar shows. A typed time is the reader's own
 * wall-clock time on the picked day.
 */
export function meetingStart(
  day: string,
  time: string,
  slot: { startAt: string } | null,
): string {
  return slot ? slot.startAt : new Date(`${day}T${time}:00`).toISOString();
}

export type NoteTarget =
  | { as: "customer"; workspace: string }
  | { as: "manager"; companyId: string; userId: number };

/** Which thread a note goes into. The customer has one; the manager opens the one with that person. */
export function noteTarget(
  m: Meeting,
  viewer: "manager" | "customer",
): NoteTarget {
  return viewer === "customer"
    ? { as: "customer", workspace: m.companyId }
    : { as: "manager", companyId: m.companyId, userId: counterpart(m).userId };
}

/**
 * Per-company reads, merged. A company that refuses (unpaid, frozen) adds
 * nothing; only when EVERY read was "route not found" is the feature itself
 * missing, which is the state before the backend deploys.
 */
export function settleMeetings(results: PromiseSettledResult<Meeting[]>[]): {
  meetings: Meeting[];
  unavailable: boolean;
} {
  const meetings = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );
  const unavailable =
    results.length > 0 &&
    results.every(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof ApiError &&
        r.reason.status === 404,
    );
  return { meetings, unavailable };
}

/* ------------------------------------------------------------------- api -- */

export interface MeetingInput {
  title: string;
  description?: string;
  /** ISO with a zone. */
  startAt: string;
  durationMinutes: number;
  /** IANA, e.g. Asia/Kolkata. */
  timezone: string;
  participantEmail: string;
}

export interface MicrosoftStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
}

const scope = (companyId: string) =>
  `companyId=${encodeURIComponent(companyId)}`;
const one = (m: Meeting) =>
  `/meetings/${encodeURIComponent(m.id)}`;

async function list(companyId: string, companyName = ""): Promise<Meeting[]> {
  // Newest first: past 100 on one company it is the oldest history that falls
  // off, not the meetings still to come.
  const data = await get<{ meetings: BackendMeeting[] }>(
    `/meetings?${scope(companyId)}&sort=startAt&order=desc&limit=100`,
  );
  return data.meetings.map((row) => toMeeting(row, companyName));
}

export const meetingsApi = {
  list,

  /**
   * Every meeting across the manager's active companies.
   *
   * ponytail: one read per company, bounded by the manager's book (a handful).
   * `GET /meetings/mine` (backend list #13) makes it one.
   */
  async listAll(): Promise<{ meetings: Meeting[]; unavailable: boolean }> {
    const companies = (await managerApi.companies()).filter((c) => !c.inactive);
    return settleMeetings(
      await Promise.allSettled(companies.map((c) => list(c.id, c.name))),
    );
  },

  /** The manager's free slots on one day, for a request. */
  async availability(
    companyId: string,
    date: string,
    durationMinutes: number,
  ): Promise<{ startAt: string; endAt: string }[]> {
    const data = await get<{ slots: { startAt: string; endAt: string }[] }>(
      `/meetings/availability?${scope(companyId)}&date=${encodeURIComponent(date)}&durationMinutes=${durationMinutes}`,
    );
    return data.slots;
  },

  async create(companyId: string, input: MeetingInput): Promise<Meeting> {
    // No link: the server creates the Teams meeting on the manager's calendar.
    const body: Record<string, unknown> = { ...input };
    if (!input.description) delete body.description;
    return toMeeting(
      await post<BackendMeeting>(`/meetings?${scope(companyId)}`, body),
    );
  },

  /** The manager accepts a request; the server creates the Teams meeting. */
  async accept(m: Meeting): Promise<Meeting> {
    return toMeeting(
      await patch<BackendMeeting>(`${one(m)}?${scope(m.companyId)}`, {
        createTeamsMeeting: true,
      }),
      m.companyName,
    );
  },

  /** Decline, cancel and withdraw are all this call; the server decides which it may be. */
  async cancel(m: Meeting, reason?: string): Promise<Meeting> {
    return toMeeting(
      await post<BackendMeeting>(
        `${one(m)}/cancel?${scope(m.companyId)}`,
        reason?.trim() ? { reason: reason.trim() } : {},
      ),
      m.companyName,
    );
  },

  /** The customer answers an invitation. Shape proposed in backend list #13. */
  async respond(
    m: Meeting,
    response: "ACCEPTED" | "DECLINED",
    note?: string,
  ): Promise<Meeting> {
    return toMeeting(
      await post<BackendMeeting>(
        `${one(m)}/respond?${scope(m.companyId)}`,
        note?.trim() ? { response, note: note.trim() } : { response },
      ),
      m.companyName,
    );
  },

  async microsoftStatus(): Promise<MicrosoftStatus> {
    const data = await get<MicrosoftStatus>("/integrations/microsoft/status");
    return {
      configured: data.configured,
      connected: data.connected,
      accountEmail: data.accountEmail ?? null,
    };
  },

  /** Where to send the browser to connect. Refused unless it is https. */
  async microsoftConnectUrl(): Promise<string> {
    const { url } = await get<{ url: string }>(
      "/integrations/microsoft/connect",
    );
    const safe = httpsOnly(url);
    if (!safe) throw new Error("Microsoft sign-in is not available right now.");
    return safe;
  },

  async disconnectMicrosoft(): Promise<void> {
    await del("/integrations/microsoft");
  },

  /** Leave the chat line for a meeting event in the right thread. */
  async sendNote(target: NoteTarget, body: string): Promise<void> {
    if (target.as === "customer") {
      await customerApi.sendMessage(target.workspace, body);
      return;
    }
    const conversationId = await managerApi.openThread(
      target.companyId,
      target.userId,
    );
    await managerApi.sendMessage(conversationId, body);
  },
};
