"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";

import { MeetingActions } from "@/components/portal/meeting-actions";
import { useTimeZone } from "@/components/portal/use-time-zone";
import { Badge } from "@/components/ui/badge";
import {
  counterpart,
  dayGroups,
  formatClock,
  groupMeetings,
  meetingLabel,
  type Meeting,
  type MeetingLabel,
} from "@/lib/meetings";
import { cn } from "@/lib/utils";

type Viewer = "manager" | "customer";
export type AgendaTab = "upcoming" | "past";

/** Status colors. The word is always printed too: color is never the only signal. */
const TONE: Record<MeetingLabel, string> = {
  Expired: "bg-muted text-muted-foreground",
  "Reply Needed": "bg-[#fef3c7] text-[#92400e]",
  Requested: "bg-[#fef3c7] text-[#92400e]",
  Scheduled: "bg-[#dcfce7] text-[#166534]",
  Declined: "bg-destructive/10 text-destructive",
  Canceled: "bg-destructive/10 text-destructive",
  Completed: "bg-muted text-muted-foreground",
};

export function MeetingBadge({ meeting, viewer }: { meeting: Meeting; viewer: Viewer }) {
  const label = meetingLabel(meeting, viewer);
  return (
    <Badge variant="secondary" className={cn("border-transparent font-medium", TONE[label])}>
      {label}
    </Badge>
  );
}

/** "Nov" over "24" — the date block on rows and chat cards. */
export function DateBlock({ iso, timeZone, muted = false }: { iso: string; timeZone: string; muted?: boolean }) {
  const d = new Date(iso);
  const month = new Intl.DateTimeFormat("en-US", { timeZone, month: "short" }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(d);
  return (
    <div
      aria-hidden
      className={cn(
        "grid w-12 shrink-0 justify-items-center rounded-lg py-1.5",
        muted ? "bg-muted text-muted-foreground" : "bg-primary/8 text-primary",
      )}
    >
      <span className="text-xs leading-4 font-semibold">{month}</span>
      <span className="text-lg leading-6 font-semibold">{day}</span>
    </div>
  );
}

const clock = formatClock;

/** Who and why, on one muted line. */
function detail(m: Meeting, viewer: Viewer, showCompany: boolean): string {
  const person = viewer === "manager" ? counterpart(m).name : m.organizer.name;
  const parts = [person];
  if (showCompany && m.companyName) parts.push(m.companyName);
  const label = meetingLabel(m, viewer);
  if (label === "Canceled" || label === "Declined") {
    if (m.cancelReason) parts.push(m.cancelReason);
  } else if (m.status === "REQUESTED" && viewer === "customer") {
    parts.push("Waiting for them to accept");
  } else if (label === "Reply Needed" && viewer === "manager") {
    parts.push(`Requested by ${m.createdBy.name}`);
  }
  return parts.join(" · ");
}

function Row({
  meeting: m,
  viewer,
  showCompany,
  timeZone,
}: {
  meeting: Meeting;
  viewer: Viewer;
  showCompany: boolean;
  timeZone: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="grid w-24 shrink-0 gap-0.5">
        <span className="text-sm font-semibold tabular-nums">{clock(m.startAt, timeZone)}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {clock(m.endAt, timeZone, true)}
        </span>
      </div>
      <div className="grid min-w-0 flex-[1_1_14rem] gap-0.5">
        <span className="truncate text-sm font-semibold">{m.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {detail(m, viewer, showCompany)}
        </span>
      </div>
      <MeetingBadge meeting={m} viewer={viewer} />
      <MeetingActions meeting={m} viewer={viewer} layout="row" />
    </li>
  );
}

/**
 * The customer's next meeting, big, with Join — the one thing most visits are
 * for. Nothing when there is no scheduled meeting to join yet.
 */
export function NextMeeting({ meetings }: { meetings: Meeting[] }) {
  const timeZone = useTimeZone();
  const next = groupMeetings(meetings, "customer").upcoming.find(
    (m) => m.status === "SCHEDULED" && m.joinUrl && new Date(m.endAt) > new Date(),
  );
  if (!next) return null;

  return (
    <section
      aria-labelledby="next-meeting"
      className="flex flex-wrap items-center gap-4 rounded-xl bg-primary/8 px-6 py-5"
    >
      <DateBlock iso={next.startAt} timeZone={timeZone} />
      <div className="grid min-w-0 flex-[1_1_16rem] gap-0.5">
        <span className="text-xs font-semibold text-primary">Next Meeting</span>
        <h2 id="next-meeting" className="truncate text-lg font-semibold">
          {next.title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {clock(next.startAt, timeZone)} – {clock(next.endAt, timeZone, true)} · with{" "}
          {next.organizer.name}
          {next.teams ? " · Teams meeting" : ""}
        </span>
      </div>
      <MeetingActions meeting={next} viewer="customer" layout="card" />
    </section>
  );
}

/**
 * The Meetings list (Option B of the 22 Nov mockup): what waits on the reader,
 * pinned on top with its buttons, then the meetings by day.
 */
export function MeetingsAgenda({
  meetings,
  viewer,
  showCompany,
  tab: initialTab,
}: {
  meetings: Meeting[];
  viewer: Viewer;
  /** The manager's cross-company list names the company on every row. */
  showCompany: boolean;
  /** From `?tab=`, so a shared or reloaded address opens the same tab. */
  tab: AgendaTab;
}) {
  /*
   * Switched in the browser, not by navigating: both tabs are already in
   * `meetings`, so a server round trip (and the per-company sweep behind it)
   * would fetch nothing new. The address follows along so Back, reload and a
   * copied link still land on the same tab.
   */
  const [tab, setTab] = React.useState(initialTab);
  const pick = (next: AgendaTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "past") url.searchParams.set("tab", "past");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  };
  const timeZone = useTimeZone();
  const { needsReply, upcoming, past } = groupMeetings(meetings, viewer);
  const shown = tab === "past" ? past : upcoming;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());

  return (
    <div className="grid gap-8">
      {needsReply.length ? (
        <section aria-labelledby="needs-reply" className="grid gap-3">
          <div className="flex items-center gap-2">
            <h2 id="needs-reply" className="text-base font-semibold">
              Needs Your Reply
            </h2>
            <Badge variant="secondary" className="border-transparent bg-[#fef3c7] text-[#92400e]">
              {needsReply.length}
            </Badge>
          </div>
          <ul className="grid gap-2">
            {needsReply.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <DateBlock iso={m.startAt} timeZone={timeZone} />
                <div className="grid min-w-0 flex-[1_1_14rem] gap-0.5">
                  <span className="truncate text-sm font-semibold">{m.title}</span>
                  <span className="text-xs tabular-nums">
                    {new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date(m.startAt))}{" "}
                    · {clock(m.startAt, timeZone)} – {clock(m.endAt, timeZone, true)} · {m.durationMinutes} min
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {viewer === "manager"
                      ? `Requested by ${m.createdBy.name}${showCompany && m.companyName ? ` · ${m.companyName}` : ""}`
                      : `${m.organizer.name} invited you${m.description ? ` · ${m.description}` : ""}`}
                  </span>
                </div>
                <MeetingActions meeting={m} viewer={viewer} layout="row" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Meetings" className="grid gap-4">
        <div role="group" aria-label="Meetings by time" className="flex gap-1 border-b border-border">
          {(
            [
              ["upcoming", "Upcoming", upcoming.length],
              ["past", "Past", past.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              aria-pressed={key === tab}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                key === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <CalendarClock className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {tab === "past" ? "No past meetings." : "No upcoming meetings."}
            </p>
          </div>
        ) : (
          dayGroups(shown, timeZone).map((group) => (
            <div key={group.key} className="grid gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {group.label}
                {group.key === today ? (
                  <Badge variant="secondary" className="border-transparent bg-primary/10 text-primary">
                    Today
                  </Badge>
                ) : null}
              </h3>
              <ul className="grid gap-2">
                {group.meetings.map((m) => (
                  <Row key={m.id} meeting={m} viewer={viewer} showCompany={showCompany} timeZone={timeZone} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
