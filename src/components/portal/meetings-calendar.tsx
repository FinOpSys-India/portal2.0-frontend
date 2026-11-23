"use client";

import * as React from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MeetingActions } from "@/components/portal/meeting-actions";
import { MeetingBadge } from "@/components/portal/meetings-agenda";
import { useTimeZone } from "@/components/portal/use-time-zone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  counterpart,
  formatWhen,
  meetingLabel,
  occurrences,
  type Meeting,
} from "@/lib/meetings";
import { cn } from "@/lib/utils";

const HOUR_PX = 48;
const WEEK = { weekStartsOn: 1 } as const;

type Placed = { meeting: Meeting; startAt: Date; endAt: Date };

/** True only in the browser: dates here are the reader's local days. */
const subscribe = () => () => {};
function useMounted() {
  return React.useSyncExternalStore(subscribe, () => true, () => false);
}

function blockStyle(m: Meeting) {
  const label = meetingLabel(m, "manager");
  if (label === "Canceled") return "border-border bg-muted text-muted-foreground line-through";
  if (label === "Completed" || label === "Expired") return "border-border bg-muted text-muted-foreground";
  if (label === "Reply Needed" || label === "Requested")
    return "border-dashed border-[#d97706] bg-[#fef3c7] text-[#92400e]";
  if (label === "Declined") return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-primary/40 bg-primary/10 text-foreground";
}

/**
 * The manager's meetings as a week or month grid, in the reader's own time
 * zone. Portal meetings only: the manager's other Outlook events need a call
 * the backend does not have yet (backend list #13, after 27 Nov).
 *
 * ponytail: meetings at the same time draw over each other; side-by-side
 * columns when two clashes a week turn out to be normal.
 */
export function MeetingsCalendar({ meetings }: { meetings: Meeting[] }) {
  const mounted = useMounted();
  const timeZone = useTimeZone();
  const [mode, setMode] = React.useState<"week" | "month">("week");
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [open, setOpen] = React.useState<Placed | null>(null);

  // Reserves the grid's space so nothing shifts when it draws.
  if (!mounted) return <div aria-hidden className="h-[640px] w-full animate-pulse rounded-xl bg-muted" />;

  const range =
    mode === "week"
      ? { from: startOfWeek(anchor, WEEK), to: addDays(startOfWeek(anchor, WEEK), 7) }
      : {
          from: startOfWeek(startOfMonth(anchor), WEEK),
          to: addDays(endOfWeek(endOfMonth(anchor), WEEK), 1),
        };

  const placed: Placed[] = meetings
    .flatMap((meeting) =>
      occurrences(meeting, range.from, range.to).map((o) => ({ meeting, ...o })),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const step = (n: number) =>
    setAnchor((d) => (mode === "week" ? addWeeks(d, n) : addMonths(d, n)));
  const unit = mode === "week" ? "week" : "month";
  const title =
    mode === "week"
      ? `${format(range.from, "MMM d")} – ${format(addDays(range.from, 6), "MMM d, yyyy")}`
      : format(anchor, "MMMM yyyy");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Previous ${unit}`} onClick={() => step(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Next ${unit}`} onClick={() => step(1)}>
          <ChevronRight aria-hidden />
        </Button>
        <h2 className="text-base font-semibold" aria-live="polite">
          {title}
        </h2>
        <div role="group" aria-label="Calendar range" className="ml-auto flex rounded-lg border border-border p-0.5">
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      {mode === "week" ? (
        <WeekGrid from={range.from} placed={placed} onOpen={setOpen} />
      ) : (
        <MonthGrid
          anchor={anchor}
          from={range.from}
          to={range.to}
          placed={placed}
          onOpen={setOpen}
          onDay={(day) => {
            setAnchor(day);
            setMode("week");
          }}
        />
      )}

      <p className="text-xs text-muted-foreground">Times are in {timeZone}.</p>

      <Dialog open={!!open} onOpenChange={(next) => !next && setOpen(null)}>
        {open ? (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{open.meeting.title}</DialogTitle>
              <DialogDescription>
                {formatWhen(open.startAt.toISOString(), open.endAt.toISOString(), timeZone)}
              </DialogDescription>
            </DialogHeader>
            <MeetingDetails meeting={open.meeting} />
            <MeetingActions
              meeting={open.meeting}
              viewer="manager"
              layout="card"
              onDone={() => setOpen(null)}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function MeetingDetails({ meeting: m }: { meeting: Meeting }) {
  const person = counterpart(m);
  const answer = m.participants.find((p) => p.userId === person.userId)?.response;
  return (
    <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Status</dt>
      <dd>
        <MeetingBadge meeting={m} viewer="manager" />
      </dd>
      <dt className="text-muted-foreground">With</dt>
      <dd>
        {person.name}
        {answer === "ACCEPTED" ? " · accepted" : answer === "DECLINED" ? " · declined" : m.status === "SCHEDULED" ? " · no reply yet" : ""}
      </dd>
      {m.companyName ? (
        <>
          <dt className="text-muted-foreground">Company</dt>
          <dd>{m.companyName}</dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">Where</dt>
      <dd>{m.teams ? "Teams meeting" : m.joinUrl ? "Meeting link" : "Link added when accepted"}</dd>
      {m.description ? (
        <>
          <dt className="text-muted-foreground">Description</dt>
          <dd className="break-words">{m.description}</dd>
        </>
      ) : null}
      {m.cancelReason ? (
        <>
          <dt className="text-muted-foreground">Reason</dt>
          <dd className="break-words">{m.cancelReason}</dd>
        </>
      ) : null}
    </dl>
  );
}

function WeekGrid({
  from,
  placed,
  onOpen,
}: {
  from: Date;
  placed: Placed[];
  onOpen: (p: Placed) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const now = new Date();

  // Working hours, stretched to fit anything booked outside them.
  let first = 8;
  let last = 20;
  for (const p of placed) {
    first = Math.min(first, p.startAt.getHours());
    last = Math.max(last, Math.ceil(differenceInMinutes(p.endAt, startOfDay(p.startAt)) / 60));
  }
  last = Math.min(last, 24);
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (d: Date) => ((d.getHours() - first) * 60 + d.getMinutes()) * (HOUR_PX / 60);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="grid min-w-[52rem] grid-cols-[4rem_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-border" />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "border-b border-l border-border px-2 py-2 text-center text-xs font-medium",
              isSameDay(d, now) ? "text-primary" : "text-muted-foreground",
            )}
          >
            {format(d, "EEE")}{" "}
            <span className={cn("text-sm font-semibold", isSameDay(d, now) && "rounded-full bg-primary px-1.5 text-primary-foreground")}>
              {format(d, "d")}
            </span>
          </div>
        ))}

        <div>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[11px] text-muted-foreground">
              {format(new Date(2000, 0, 1, h), "h a")}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const today = placed.filter((p) => isSameDay(p.startAt, day));
          return (
            <div key={day.toISOString()} className="relative border-l border-border">
              {hours.map((h) => {
                const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h);
                return slot > now ? (
                  <Link
                    key={h}
                    // Up to 84 of these per week; each prefetch would be a full
                    // render of the schedule page (see admin/pager.tsx).
                    prefetch={false}
                    href={`/manager/meetings/new?date=${format(slot, "yyyy-MM-dd")}&time=${format(slot, "HH:mm")}`}
                    aria-label={`Schedule on ${format(slot, "EEE, MMM d")} at ${format(slot, "h:mm a")}`}
                    style={{ height: HOUR_PX }}
                    className="block border-b border-border/60 hover:bg-accent/50 focus-visible:relative focus-visible:z-30 focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
                  />
                ) : (
                  <div key={h} style={{ height: HOUR_PX }} className="border-b border-border/60 bg-muted/30" />
                );
              })}

              {isSameDay(day, now) && now.getHours() >= first && now.getHours() < last ? (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-destructive" style={{ top: top(now) }} />
              ) : null}

              {today.map((p) => (
                <button
                  key={`${p.meeting.id}-${p.startAt.toISOString()}`}
                  type="button"
                  onClick={() => onOpen(p)}
                  style={{
                    top: top(p.startAt),
                    height: Math.max(22, differenceInMinutes(p.endAt, p.startAt) * (HOUR_PX / 60) - 2),
                  }}
                  className={cn(
                    "absolute inset-x-1 z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    blockStyle(p.meeting),
                  )}
                >
                  <span className="block truncate font-semibold">{p.meeting.title}</span>
                  <span className="sr-only">, {meetingLabel(p.meeting, "manager")}</span>
                  <span className="block truncate">
                    {format(p.startAt, "h:mm")} – {format(p.endAt, "h:mm a")}
                    {p.meeting.companyName ? ` · ${p.meeting.companyName}` : ""}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({
  anchor,
  from,
  to,
  placed,
  onOpen,
  onDay,
}: {
  anchor: Date;
  from: Date;
  to: Date;
  placed: Placed[];
  onOpen: (p: Placed) => void;
  onDay: (day: Date) => void;
}) {
  const days: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const now = new Date();

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="grid min-w-[52rem] grid-cols-7">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="border-b border-border px-2 py-2 text-xs font-medium text-muted-foreground">
            {format(d, "EEE")}
          </div>
        ))}
        {days.map((day) => {
          const onDayList = placed.filter((p) => isSameDay(p.startAt, day));
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "grid min-h-28 content-start gap-1 border-b border-l border-border p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0",
                !isSameMonth(day, anchor) && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  isSameDay(day, now) ? "w-fit rounded-full bg-primary px-1.5 text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              {onDayList.slice(0, 3).map((p) => (
                <button
                  key={`${p.meeting.id}-${p.startAt.toISOString()}`}
                  type="button"
                  onClick={() => onOpen(p)}
                  className={cn(
                    "truncate rounded border px-1 text-left text-[11px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    blockStyle(p.meeting),
                  )}
                >
                  {format(p.startAt, "h:mm a")} {p.meeting.title}
                  <span className="sr-only">, {meetingLabel(p.meeting, "manager")}</span>
                </button>
              ))}
              {onDayList.length > 3 ? (
                <button
                  type="button"
                  onClick={() => onDay(day)}
                  className="w-fit text-left text-[11px] font-medium text-primary hover:underline"
                >
                  +{onDayList.length - 3} more
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
