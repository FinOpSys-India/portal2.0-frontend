"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, startOfToday } from "date-fns";
import { Globe, Video } from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { FormAlert } from "@/components/auth/form-alert";
import { useTimeZone } from "@/components/portal/use-time-zone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/http";
import {
  formatWhen,
  zoneLongName,
  meetingNote,
  meetingStart,
  meetingsApi,
  noteTarget,
  type Meeting,
  type MicrosoftStatus,
} from "@/lib/meetings";
import { requestMeetingSchema, scheduleMeetingSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** Someone the manager can meet: a customer-side person on one of their companies. */
export interface Invitee {
  userId: number;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
}

type Slot = { startAt: string; endAt: string };
type Errors = Partial<Record<string, string>>;

type Props =
  | {
      mode: "schedule";
      people: Invitee[];
      microsoft: MicrosoftStatus | null;
      initial: {
        companyId?: string;
        withUserId?: number;
        title?: string;
        description?: string;
        date?: string;
        time?: string;
      };
    }
  | {
      mode: "request";
      companyId: string;
      manager: { name: string; email: string };
      initial: { title?: string; description?: string };
    };

const FIELD_ORDER = ["participantEmail", "title", "description", "durationMinutes", "date", "time"];

/** The API's field names onto this form's. */
const API_FIELD: Record<string, string> = {
  startAt: "time",
  participantEmail: "participantEmail",
  title: "title",
  description: "description",
  durationMinutes: "durationMinutes",
};

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

function clock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** HH:mm in the reader's own zone, for a slot the manager picks. */
function localTime(iso: string) {
  return format(new Date(iso), "HH:mm");
}

/**
 * Schedule (manager) or request (customer) a meeting, as a full page laid out
 * like a booking page: details on the left, a month in the middle, the day's
 * times on the right, and the summary with the button underneath
 * (Siddharth, 22 Nov: "full view", after Calendly).
 *
 * The customer only ever picks from the manager's free times; the API refuses
 * anything else. The manager may pick any hour — "Other Time" — and the API
 * refuses only a clash.
 */
export function BookingView(props: Props) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const schedule = props.mode === "schedule";

  const firstPerson = schedule
    ? props.people.find(
        (p) =>
          p.userId === props.initial.withUserId &&
          (!props.initial.companyId || p.companyId === props.initial.companyId),
      )
    : undefined;

  const [person, setPerson] = React.useState<Invitee | undefined>(firstPerson);
  const [title, setTitle] = React.useState(props.initial.title ?? "");
  const [description, setDescription] = React.useState(props.initial.description ?? "");
  const [duration, setDuration] = React.useState(30);
  const [date, setDate] = React.useState<Date | undefined>(() => {
    const d = schedule ? props.initial.date : undefined;
    return d ? new Date(`${d}T00:00:00`) : undefined;
  });
  const [time, setTime] = React.useState(schedule ? (props.initial.time ?? "") : "");
  const [slot, setSlot] = React.useState<Slot | null>(null);
  const teamsReady = schedule && !!props.microsoft?.connected;

  const [errors, setErrors] = React.useState<Errors>({});
  const [alert, setAlert] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const companyId = schedule ? person?.companyId : props.companyId;
  const day = date ? ymd(date) : "";
  const backHref = schedule ? "/manager/meetings" : `/customer/${props.mode === "request" ? props.companyId : ""}/meetings`;

  // The day's free times. Read only when the day, the length or the company
  // changes (or after a slot was taken): availability shares a
  // 60-per-15-minutes limit with the writes. "Loading" is derived — no answer
  // for the current key yet — rather than set, so the effect only ever sets
  // state once the answer arrives.
  const [retry, setRetry] = React.useState(0);
  const slotKey =
    companyId && day && (!schedule || teamsReady) ? `${companyId}|${day}|${duration}|${retry}` : "";
  const [answer, setAnswer] = React.useState<{
    key: string;
    slots: Slot[] | null;
    state: "ok" | "closed" | "failed";
  } | null>(null);

  React.useEffect(() => {
    if (!slotKey || !companyId) return;
    let live = true;
    meetingsApi.availability(companyId, day, duration).then(
      (found) => {
        if (live) setAnswer({ key: slotKey, slots: found, state: "ok" });
      },
      (err) => {
        if (!live) return;
        const closed = err instanceof ApiError && err.code === "MANAGER_CALENDAR_NOT_CONNECTED";
        setAnswer({ key: slotKey, slots: null, state: closed ? "closed" : "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [slotKey, companyId, day, duration]);

  const current = slotKey && answer?.key === slotKey ? answer : null;
  const slots = current?.slots ?? null;
  const slotsState: "idle" | "loading" | "closed" | "failed" = !slotKey
    ? "idle"
    : !current
      ? "loading"
      : current.state === "ok"
        ? "idle"
        : current.state;

  function pickDay(next: Date | undefined) {
    setDate(next);
    setSlot(null);
    if (!schedule) setTime("");
  }

  function fail(found: Errors, message?: string) {
    setErrors(found);
    setAlert(message ?? null);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (!first) return;
    // The calendar and the time buttons are not one focusable control, so a
    // missing day or time moves focus to that column's heading instead; the
    // error itself is announced (role="alert" below).
    const target =
      first === "date" ? "booking-day" : first === "time" && !schedule ? "booking-times" : `booking-${first}`;
    document.getElementById(target)?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setAlert(null);

    const checked = schedule
      ? scheduleMeetingSchema.safeParse({
          companyId: person?.companyId ?? "",
          participantEmail: person?.email ?? "",
          title,
          description,
          durationMinutes: duration,
          date: day,
          time,
        })
      : requestMeetingSchema.safeParse({
          title,
          description,
          durationMinutes: duration,
          startAt: slot?.startAt ?? "",
        });

    if (!checked.success) {
      const found: Errors = {};
      for (const issue of checked.error.issues) {
        const key = String(issue.path[0]);
        const mine = key === "companyId" ? "participantEmail" : key === "startAt" ? "time" : key;
        found[mine] ??= issue.message;
      }
      if (!day) found.date ??= "Choose a date.";
      fail(found);
      return;
    }

    setBusy(true);
    try {
      let created: Meeting;
      if (schedule) {
        created = await meetingsApi.create(person!.companyId, {
          title: title.trim(),
          description: description.trim() || undefined,
          startAt: meetingStart(day, time, slot),
          durationMinutes: duration,
          timezone: timeZone,
          participantEmail: person!.email,
        });
      } else {
        created = await meetingsApi.create(props.companyId, {
          title: title.trim(),
          description: description.trim() || undefined,
          startAt: slot!.startAt,
          durationMinutes: duration,
          timezone: timeZone,
          participantEmail: props.manager.email,
        });
      }

      const viewer = schedule ? "manager" : "customer";
      await meetingsApi
        .sendNote(noteTarget(created, viewer), meetingNote(created, schedule ? "scheduled" : "requested", timeZone))
        .catch(() => toast.error("The meeting is saved, but the chat note was not sent."));
      toast.success(schedule ? "Meeting scheduled." : "Request sent.");
      router.push(backHref);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        fail({}, "That didn’t go through. Try again.");
      } else if (err.code === "SLOT_UNAVAILABLE") {
        setSlot(null);
        setRetry((n) => n + 1);
        fail({ time: "That time was just taken. Pick another time." });
      } else if (err.code === "MICROSOFT_NOT_CONNECTED" || err.code === "MICROSOFT_RECONNECT_REQUIRED") {
        fail({}, "Connect your Microsoft account on the Meetings page first.");
      } else if (err.status === 404) {
        fail({}, "Meetings aren’t available yet. Try again once the server supports them.");
      } else {
        const found: Errors = {};
        for (const [key, message] of Object.entries(err.fields ?? {})) {
          const mine = API_FIELD[key];
          if (mine) found[mine] = message;
        }
        fail(found, Object.keys(found).length ? undefined : err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const described = (field: string) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `booking-${field}-error` } : {};
  const fieldError = (field: string) =>
    errors[field] ? (
      <p
        id={`booking-${field}-error`}
        role={field === "date" || field === "time" ? "alert" : undefined}
        className="text-xs font-medium text-destructive"
      >
        {errors[field]}
      </p>
    ) : null;

  const today = startOfToday();
  const durations = schedule ? [15, 30, 45, 60] : [30, 60];
  const chosen = schedule ? (time ? format(new Date(`2000-01-01T${time}`), "h:mm a") : "") : slot ? clock(slot.startAt, timeZone) : "";
  const other = schedule ? person?.name : props.manager.name;
  const withWhom = other ? ` · with ${other}` : "";
  const summary = slot
    ? `${formatWhen(slot.startAt, slot.endAt, timeZone)}${withWhom}`
    : date && chosen
      ? `${format(date, "EEE, MMM d, yyyy")} · ${chosen} · ${duration} min${withWhom}`
      : date
        ? `Pick a time on ${format(date, "EEE, MMM d")}`
        : "Pick a day, then a time";

  // Group the manager's people by company, in the order the companies came.
  const groups = schedule
    ? props.people.reduce<{ companyId: string; companyName: string; people: Invitee[] }[]>((all, p) => {
        const group = all.find((g) => g.companyId === p.companyId);
        if (group) group.people.push(p);
        else all.push({ companyId: p.companyId, companyName: p.companyName, people: [p] });
        return all;
      }, [])
    : [];
  const personKey = (p: Invitee) => `${p.companyId}:${p.userId}`;

  return (
    <form onSubmit={submit} noValidate className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap">
        {/* Details */}
        <section aria-label="Details" className="flex min-w-0 flex-[1_1_18rem] flex-col gap-4 border-border p-6 lg:border-r">
          {schedule ? (
            <h2 className="text-base font-semibold">Details</h2>
          ) : (
            <div className="flex items-center gap-3">
              <InitialsAvatar name={props.manager.name} />
              <div className="grid">
                <span className="text-sm font-semibold">{props.manager.name}</span>
                <span className="text-xs text-muted-foreground">Accounting Manager</span>
              </div>
            </div>
          )}

          {!schedule ? (
            <ul className="grid gap-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Video className="mt-0.5 size-4 shrink-0" aria-hidden />
                The Teams link arrives once {props.manager.name} accepts.
              </li>
              <li className="flex gap-2">
                <Globe className="mt-0.5 size-4 shrink-0" aria-hidden />
                Times are shown in {zoneLongName(timeZone)}.
              </li>
            </ul>
          ) : null}

          {schedule ? (
            <div className="grid gap-2">
              <Label htmlFor="booking-participantEmail">
                With <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Select
                value={person ? personKey(person) : undefined}
                onValueChange={(key) => {
                  setPerson(props.people.find((p) => personKey(p) === key));
                  setSlot(null);
                }}
              >
                <SelectTrigger id="booking-participantEmail" className="w-full" {...described("participantEmail")}>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectGroup key={g.companyId}>
                      <SelectLabel>{g.companyName}</SelectLabel>
                      {g.people.map((p) => (
                        <SelectItem key={personKey(p)} value={personKey(p)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("participantEmail")}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="booking-title">
              Title <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="booking-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="For example, Q3 books review"
              {...described("title")}
            />
            {fieldError("title")}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="booking-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="booking-description"
              value={description}
              maxLength={5000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What you’d like to cover"
              {...described("description")}
            />
            {fieldError("description")}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="booking-durationMinutes">Duration</Label>
            <Select
              value={String(duration)}
              onValueChange={(v) => {
                setDuration(Number(v));
                setSlot(null);
              }}
            >
              <SelectTrigger id="booking-durationMinutes" className="w-full" {...described("durationMinutes")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durations.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("durationMinutes")}
          </div>

          {schedule ? (
            // Every meeting is a Teams meeting on the manager's own calendar
            // (Siddharth, 23 Nov); there is no other kind to choose.
            teamsReady ? (
              <p className="flex gap-2 rounded-lg border border-border p-3 text-sm">
                <Video className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="grid gap-0.5">
                  <span className="font-medium">Teams meeting</span>
                  <span className="text-xs text-muted-foreground">
                    Created on your calendar as {props.microsoft?.accountEmail ?? "your Microsoft account"}. Microsoft emails the invitation.
                  </span>
                </span>
              </p>
            ) : (
              <Alert>
                <Video className="size-4" aria-hidden />
                <AlertDescription>
                  {props.microsoft?.configured === false
                    ? "Teams isn’t set up on this server yet, so meetings can’t be scheduled."
                    : "Meetings are Teams meetings on your calendar. Connect your Microsoft account first."}
                  {props.microsoft?.configured === false ? null : (
                    <>
                      {" "}
                      <Link href="/manager/meetings" className="font-medium underline underline-offset-2">
                        Connect Microsoft
                      </Link>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )
          ) : null}
        </section>

        {/* Day */}
        <section aria-labelledby="booking-day" className="flex min-w-0 flex-[2_1_22rem] flex-col gap-3 border-border p-6 lg:border-r">
          <h2 id="booking-day" tabIndex={-1} className="text-base font-semibold focus-visible:outline-none">
            Select a Date
          </h2>
          <Calendar
            id="booking-date"
            mode="single"
            selected={date}
            onSelect={pickDay}
            defaultMonth={date ?? today}
            disabled={schedule ? { before: today } : [{ before: today }, { dayOfWeek: [0, 6] }]}
            className="mx-auto bg-transparent p-0 [--cell-size:--spacing(11)]"
          />
          {fieldError("date")}
          <p className="text-xs text-muted-foreground">
            {schedule
              ? `Times are in your time zone, ${zoneLongName(timeZone)}.`
              : "Monday to Friday, at least 24 hours from now."}
          </p>
        </section>

        {/* Times */}
        <section aria-labelledby="booking-times" className="flex min-w-0 flex-[1_1_15rem] flex-col gap-3 p-6">
          <h2 id="booking-times" tabIndex={-1} className="text-base font-semibold focus-visible:outline-none">
            {date ? format(date, "EEE, MMM d") : "Times"}
          </h2>

          {!date ? (
            <p className="text-sm text-muted-foreground">Pick a day to see the times.</p>
          ) : slotsState === "loading" ? (
            <Spinner className="mx-auto mt-4" />
          ) : slotsState === "closed" ? (
            <Alert>
              <AlertDescription>
                Your accounting manager hasn’t opened their calendar for booking yet.{" "}
                <Link href={`/customer/${companyId}/connect/chat`} className="font-medium underline underline-offset-2">
                  Message them in chat
                </Link>
              </AlertDescription>
            </Alert>
          ) : slotsState === "failed" ? (
            <p className="text-sm text-muted-foreground">The free times couldn’t be loaded. Try another day.</p>
          ) : slots && slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No free times on this day. Pick another day.</p>
          ) : slots ? (
            <div
              role="group"
              aria-label="Free times"
              className="flex flex-col gap-2"
            >
              {slots.map((s) => {
                const on = schedule ? time === localTime(s.startAt) : slot?.startAt === s.startAt;
                return (
                  <button
                    key={s.startAt}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setSlot(s);
                      if (schedule) setTime(localTime(s.startAt));
                    }}
                    className={cn(
                      "h-11 rounded-lg border border-primary text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                      on ? "bg-primary text-primary-foreground" : "bg-card text-primary hover:bg-primary/5",
                    )}
                  >
                    {clock(s.startAt, timeZone)}
                  </button>
                );
              })}
            </div>
          ) : null}

          {schedule ? (
            <div className="mt-2 grid gap-2">
              <Label htmlFor="booking-time">{slots?.length ? "Other Time" : "Time"}</Label>
              <Input
                id="booking-time"
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setSlot(null);
                }}
                aria-describedby={errors.time ? "booking-time-error" : "booking-time-hint"}
                aria-invalid={errors.time ? true : undefined}
              />
              <p id="booking-time-hint" className="text-xs text-muted-foreground">
                Any hour works for you. A clash with another meeting is refused.
              </p>
            </div>
          ) : null}
          {fieldError("time")}
        </section>
      </div>

      <div className="grid gap-3 border-t border-border px-6 py-4">
        <FormAlert>{alert}</FormAlert>
        <div className="flex flex-wrap items-center gap-3">
          <span aria-live="polite" className="mr-auto text-sm font-medium">
            {summary}
          </span>
          <Button asChild variant="secondary">
            <Link href={backHref}>Cancel</Link>
          </Button>
          {/* No Microsoft, no Teams meeting to create: nothing to schedule yet. */}
          <Button type="submit" disabled={busy || (schedule && !teamsReady)}>
            {busy ? <Spinner /> : null}
            {schedule ? "Schedule" : "Send Request"}
          </Button>
        </div>
      </div>
    </form>
  );
}
