"use client";

import * as React from "react";
import { CircleCheck, CircleX } from "lucide-react";

import { MeetingActions } from "@/components/portal/meeting-actions";
import { DateBlock, MeetingBadge } from "@/components/portal/meetings-agenda";
import { useTimeZone } from "@/components/portal/use-time-zone";
import {
  answerable,
  counterpart,
  formatWhen,
  meetingLabel,
  meetingsApi,
  noteFits,
  parseMeetingNote,
  type Meeting,
  type MeetingEvent,
} from "@/lib/meetings";
import type { ChatMessage } from "@/lib/manager";
import { messageTime } from "@/lib/manager";
import { cn } from "@/lib/utils";

type Viewer = "manager" | "customer";

export interface ChatMeetings {
  byId: Map<string, Meeting>;
  loaded: boolean;
  /** A note not seen before means the list may be out of date. */
  seen: (messageId: string) => void;
  reload: () => void;
}

/**
 * The meetings one thread's cards are drawn from: the company's list, read
 * once when the thread opens and again whenever a note newer than that read
 * arrives — which is how the other person's Accept turns a card green without
 * anyone refreshing.
 */
export function useChatMeetings(companyId: string | undefined): ChatMeetings {
  const [byId, setById] = React.useState(() => new Map<string, Meeting>());
  const [loaded, setLoaded] = React.useState(false);
  const inFlight = React.useRef(false);
  const read = React.useRef(false);
  const known = React.useRef(new Set<string>());

  const reload = React.useCallback(() => {
    if (!companyId || inFlight.current) return;
    inFlight.current = true;
    meetingsApi
      .list(companyId)
      .then((list) => setById(new Map(list.map((m) => [m.id, m]))))
      // No list, no cards: every note falls back to its readable line.
      .catch(() => {})
      .finally(() => {
        inFlight.current = false;
        read.current = true;
        setLoaded(true);
      });
  }, [companyId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  // By message id, not by time: a device clock that runs fast must not make
  // a fresh Accept look older than the last read.
  const seen = React.useCallback(
    (messageId: string) => {
      if (known.current.has(messageId)) return;
      known.current.add(messageId);
      if (read.current) reload();
    },
    [reload],
  );

  return { byId, loaded, seen, reload };
}

const VERB: Record<Exclude<MeetingEvent, "scheduled" | "requested">, string> = {
  accepted: "accepted",
  declined: "declined",
  canceled: "canceled",
  withdrawn: "withdrew the request for",
};

/**
 * One meeting note in a thread: a live card for "scheduled" and "requested",
 * a centered status line for what happened to it after. A note whose meeting
 * this reader cannot read stays its readable line, like any message.
 */
export function MeetingNote({
  message,
  viewer,
  otherName,
  meetings,
}: {
  message: ChatMessage;
  viewer: Viewer;
  /** The other person in this thread, for "Maya Rao accepted …". */
  otherName: string;
  meetings: ChatMeetings;
}) {
  const note = parseMeetingNote(message.body);
  const { seen } = meetings;
  React.useEffect(() => {
    seen(message.id);
  }, [seen, message.id]);

  if (!note) return null;
  const meeting = meetings.byId.get(note.meetingId);
  const who = message.mine ? "You" : otherName;

  if (note.event === "scheduled" || note.event === "requested") {
    if (!meeting) return <Fallback message={message} text={note.text} />;
    const label =
      note.event === "requested"
        ? `${who} requested a meeting`
        : viewer === "customer" && !message.mine
          ? `${who} invited you to a meeting`
          : `${who} scheduled a meeting`;
    return (
      <div className={cn("flex", message.mine && "justify-end")}>
        <div className={cn("grid w-full max-w-sm gap-1", message.mine && "justify-items-end")}>
          <span className="text-xs text-muted-foreground">
            {label} · {messageTime(message.sentAt)}
          </span>
          <MeetingCard meeting={meeting} viewer={viewer} onDone={meetings.reload} />
        </div>
      </div>
    );
  }

  // A status line only for a meeting this reader can see, in the state the
  // note claims. Anything else is what the person typed, shown as text.
  if (!meeting || !noteFits(meeting, note.event)) {
    return <Fallback message={message} text={note.text} />;
  }

  const good = note.event === "accepted";
  const Icon = good ? CircleCheck : CircleX;
  return (
    <p className="flex items-center justify-center gap-1.5 py-1 text-center text-xs text-muted-foreground">
      <Icon className={cn("size-3.5 shrink-0", good ? "text-[#166534]" : "text-destructive")} aria-hidden />
      <span>
        {who} {VERB[note.event]} “{meeting.title}” ·{" "}
        {messageTime(message.sentAt)}
      </span>
    </p>
  );
}

/** A note without its meeting: the readable line, as an ordinary bubble would show it. */
function Fallback({ message, text }: { message: ChatMessage; text: string }) {
  return (
    <div className={cn("flex", message.mine && "flex-row-reverse")}>
      <p
        className={cn(
          "w-fit max-w-[70%] rounded-xl px-3 py-1.5 text-sm break-words",
          message.mine ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {text}
      </p>
    </div>
  );
}

/** The response line under the time: where the meeting stands with the other person. */
function standing(m: Meeting, viewer: Viewer): string {
  const label = meetingLabel(m, viewer);
  if ((label === "Canceled" || label === "Declined") && m.cancelReason) {
    return `Reason: ${m.cancelReason}`;
  }
  if (m.status === "REQUESTED") {
    return viewer === "customer"
      ? `Waiting for ${m.organizer.name} to accept.`
      : "Accept to create the meeting and send the invitation.";
  }
  if (m.status === "SCHEDULED" && viewer === "manager") {
    const person = counterpart(m);
    const answer = m.participants.find((p) => p.userId === person.userId)?.response;
    if (answer === "ACCEPTED") return `Accepted by ${person.name}`;
    if (answer === "DECLINED") return `${person.name} declined`;
    return `${person.name} has not replied yet`;
  }
  if (m.canRespond && answerable(m)) return "Join shows here once you accept.";
  return m.teams ? "Teams meeting" : "";
}

export function MeetingCard({
  meeting: m,
  viewer,
  onDone,
}: {
  meeting: Meeting;
  viewer: Viewer;
  onDone?: () => void;
}) {
  const timeZone = useTimeZone();
  const label = meetingLabel(m, viewer);
  const over = label === "Canceled" || label === "Completed";
  const line = standing(m, viewer);

  return (
    <article
      aria-label={`Meeting: ${m.title}, ${label.toLowerCase()}`}
      className="w-full overflow-hidden rounded-xl border border-border bg-card text-left"
    >
      <div className="flex items-start gap-3 p-3">
        <DateBlock iso={m.startAt} timeZone={timeZone} muted={over} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className={cn("text-sm font-semibold", label === "Canceled" && "text-muted-foreground line-through")}>
              {m.title}
            </span>
            <MeetingBadge meeting={m} viewer={viewer} />
          </div>
          <span className={cn("text-xs", over && "text-muted-foreground")}>
            {formatWhen(m.startAt, m.endAt, timeZone)}
          </span>
          <span className="text-xs text-muted-foreground">
            {m.durationMinutes} min{line ? ` · ${line}` : ""}
          </span>
        </div>
      </div>
      <Footer meeting={m} viewer={viewer} onDone={onDone} />
    </article>
  );
}

function Footer({ meeting, viewer, onDone }: { meeting: Meeting; viewer: Viewer; onDone?: () => void }) {
  // MeetingActions renders nothing when nothing is allowed; the strip goes with it.
  const actions = <MeetingActions meeting={meeting} viewer={viewer} layout="card" onDone={onDone} />;
  return (
    <div className="border-t border-border bg-muted/40 px-3 py-2.5 empty:hidden">
      {actions}
    </div>
  );
}
