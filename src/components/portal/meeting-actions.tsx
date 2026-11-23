"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

import { useTimeZone } from "@/components/portal/use-time-zone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/http";
import {
  answerable,
  counterpart,
  formatWhen,
  lapsed,
  meetingNote,
  meetingsApi,
  noteTarget,
  type Meeting,
  type MeetingEvent,
} from "@/lib/meetings";

type Viewer = "manager" | "customer";

/** What a refused call tells the reader. */
function problem(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 404) {
    return "Meetings aren’t available yet. Try again once the server supports them.";
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Where a fresh meeting starts from, carrying what the old one said. */
export function againHref(m: Meeting, viewer: Viewer): string {
  const q = new URLSearchParams({ title: m.title });
  if (m.description) q.set("description", m.description);
  if (viewer === "customer") {
    return `/customer/${encodeURIComponent(m.companyId)}/meetings/new?${q}`;
  }
  q.set("company", m.companyId);
  q.set("with", String(counterpart(m).userId));
  return `/manager/meetings/new?${q}`;
}

/**
 * The buttons a meeting offers this reader, and nothing the API would refuse.
 *
 * Which ones show comes from the meeting's own flags (`canEdit`, `canCancel`,
 * `canRespond`); the role only picks the wording. Each answer the API accepts
 * leaves a note in the chat between the two people, and a note that fails to
 * send never undoes the meeting — it says so and stops.
 */
export function MeetingActions({
  meeting,
  viewer,
  layout,
  onDone,
}: {
  meeting: Meeting;
  viewer: Viewer;
  /** "row" on the Meetings page, "card" in chat and the calendar's details. */
  layout: "row" | "card";
  /** Told the meeting as the API now has it, after the note. */
  onDone?: (updated: Meeting) => void;
}) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState<null | "decline" | "cancel" | "withdraw" | "refuse">(null);
  const [reason, setReason] = React.useState("");

  const m = meeting;
  const manager = viewer === "manager";
  // The customer answers an invitation until the meeting starts; after that
  // the meeting is simply on, and Join is what's left.
  const canAnswer = m.canRespond && answerable(m);
  const live = m.status === "SCHEDULED";
  const size = "sm";

  async function act(
    call: () => Promise<Meeting>,
    event: MeetingEvent,
    done: string,
    after?: (updated: Meeting) => void,
  ) {
    setBusy(true);
    try {
      const updated = await call();
      // The meeting has changed whatever happens next; a lost note is said, not thrown.
      await meetingsApi
        .sendNote(
          noteTarget(updated, viewer),
          meetingNote(updated, event, timeZone, reason),
        )
        .catch(() =>
          toast.error("The meeting is saved, but the chat note was not sent."),
        );
      toast.success(done);
      setAsking(null);
      setReason("");
      onDone?.(updated);
      if (after) after(updated);
      else router.refresh();
    } catch (err) {
      toast.error(problem(err, "That didn’t go through. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const buttons: React.ReactNode[] = [];

  // Join, once there is a meeting to join and nothing left to answer.
  if (live && m.joinUrl && !canAnswer) {
    buttons.push(
      <Button key="join" asChild size={size} variant={layout === "card" ? "default" : "outline"}>
        <a href={m.joinUrl} target="_blank" rel="noopener noreferrer">
          <Video aria-hidden />
          Join Meeting
        </a>
      </Button>,
    );
  }

  const expired = lapsed(m);

  if (manager && m.status === "REQUESTED" && m.canEdit && !expired) {
    buttons.push(
      <Button
        key="accept"
        size={size}
        disabled={busy}
        onClick={() => act(() => meetingsApi.accept(m), "accepted", "Meeting accepted.")}
      >
        Accept
      </Button>,
    );
  }
  if (manager && m.status === "REQUESTED" && m.canCancel) {
    buttons.push(
      <Button key="decline" size={size} variant="secondary" disabled={busy} onClick={() => setAsking("decline")}>
        Decline
      </Button>,
    );
  }
  if (manager && live && m.canCancel) {
    buttons.push(
      <Button key="cancel" size={size} variant="ghost" disabled={busy} onClick={() => setAsking("cancel")}>
        Cancel Meeting
      </Button>,
    );
  }

  if (!manager && canAnswer) {
    buttons.push(
      <Button
        key="accept"
        size={size}
        disabled={busy}
        onClick={() =>
          act(() => meetingsApi.respond(m, "ACCEPTED"), "accepted", "Invitation accepted.")
        }
      >
        Accept
      </Button>,
      <Button key="refuse" size={size} variant="secondary" disabled={busy} onClick={() => setAsking("refuse")}>
        Decline
      </Button>,
    );
  }
  if (!manager && m.status === "REQUESTED" && m.canCancel && !expired) {
    buttons.push(
      <Button key="withdraw" size={size} variant="ghost" disabled={busy} onClick={() => setAsking("withdraw")}>
        Withdraw Request
      </Button>,
    );
  }
  if (!manager && m.status === "CANCELLED") {
    buttons.push(
      <Button key="again" asChild size={size} variant="outline">
        <Link href={againHref(m, viewer)}>Request Another Time</Link>
      </Button>,
    );
  }

  const when = formatWhen(m.startAt, m.endAt, timeZone);
  const other = manager ? counterpart(m).name : m.organizer.name;
  const confirm = {
    decline: {
      title: "Decline This Request?",
      body: `${m.title} · ${when}. ${other} is told by email and in chat.`,
      keep: "Keep Request",
      go: "Decline",
      withReason: true,
      run: () => act(() => meetingsApi.cancel(m, reason), "declined", "Request declined."),
    },
    cancel: {
      title: "Cancel This Meeting?",
      body: `${m.title} · ${when}. ${other} is told in chat${m.teams ? " and by Outlook" : ""}. To move it, cancel it and schedule a new one.`,
      keep: "Keep Meeting",
      go: "Cancel Meeting",
      withReason: true,
      run: () => act(() => meetingsApi.cancel(m, reason), "canceled", "Meeting canceled."),
    },
    withdraw: {
      title: "Withdraw Your Request?",
      body: `${m.title} · ${when}. ${other} is told in chat.`,
      keep: "Keep Request",
      go: "Withdraw",
      withReason: false,
      run: () => act(() => meetingsApi.cancel(m), "withdrawn", "Request withdrawn."),
    },
    refuse: {
      title: "Decline This Invitation?",
      body: `${m.title} · ${when}. ${other} is told in chat and can schedule another time.`,
      keep: "Keep Invitation",
      go: "Decline",
      withReason: true,
      run: () =>
        act(() => meetingsApi.respond(m, "DECLINED", reason), "declined", "Invitation declined."),
    },
  } as const;
  const open = asking ? confirm[asking] : null;

  if (!buttons.length) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>

      <Dialog open={!!open} onOpenChange={(next) => !busy && !next && setAsking(null)}>
        {open ? (
          <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
            <DialogHeader>
              <DialogTitle>{open.title}</DialogTitle>
              <DialogDescription>{open.body}</DialogDescription>
            </DialogHeader>
            {open.withReason ? (
              <div className="grid gap-2">
                <Label htmlFor={`reason-${m.id}`}>
                  Reason <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id={`reason-${m.id}`}
                  value={reason}
                  maxLength={1000}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="For example, not available that day"
                />
              </div>
            ) : null}
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setAsking(null)}>
                {open.keep}
              </Button>
              {asking === "cancel" ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => meetingsApi.cancel(m, reason),
                      "canceled",
                      "Meeting canceled.",
                      () => router.push(againHref(m, viewer)),
                    )
                  }
                >
                  Cancel and Schedule New
                </Button>
              ) : null}
              <Button variant="destructive" disabled={busy} onClick={open.run}>
                {open.go}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
