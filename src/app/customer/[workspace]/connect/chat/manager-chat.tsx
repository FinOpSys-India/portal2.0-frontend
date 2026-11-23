"use client";

import Link from "next/link";
import { CalendarPlus } from "lucide-react";

import { ChatThread } from "@/components/portal/chat-thread";
import { MeetingNote, useChatMeetings } from "@/components/portal/meeting-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { customerApi } from "@/lib/customer";
import { meetingsEnabled, parseMeetingNote } from "@/lib/meetings";

/**
 * The customer's chat: one pane, like the specialist's.
 *
 * Their accounting manager is the only counterparty, so a thread list would be
 * a column of one row that can never be deselected. No back button either —
 * the shell derives one for every inner page, and a second would be two
 * controls doing the same job.
 *
 * The workspace comes down as a prop rather than being read off the api: the
 * thread belongs to the company, and the same customer in two companies is
 * talking to two different threads.
 */
export function ManagerChat({
  workspace,
  contact,
  contactAvatarUrl,
  conversationId,
}: {
  workspace: string;
  contact: string;
  contactAvatarUrl: string | null;
  /** Threaded through so opening the pane clears the unread badge. */
  conversationId: string | null;
}) {
  const meetingsOn = meetingsEnabled();
  // Off, nothing is read and every message stays a bubble.
  const meetings = useChatMeetings(meetingsOn ? workspace : undefined);

  return (
    // The shell pads the page; the pane takes what is left of the viewport so
    // the thread scrolls inside itself rather than growing the page.
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-4">
      <h1 className="font-semibold">Chat</h1>

      <ChatThread
        contact={contact}
        contactAvatarUrl={contactAvatarUrl}
        badge={<Badge variant="secondary">Accounting Manager</Badge>}
        conversationId={conversationId}
        load={() => customerApi.messages(workspace)}
        send={(body) => customerApi.sendMessage(workspace, body)}
        sendFile={(file) => customerApi.sendAttachment(workspace, file)}
        action={
          meetingsOn ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/customer/${workspace}/meetings/new`}>
                <CalendarPlus aria-hidden />
                Request a Meeting
              </Link>
            </Button>
          ) : undefined
        }
        renderNote={
          meetingsOn
            ? (message) =>
                !message.deleted && parseMeetingNote(message.body) ? (
                  <MeetingNote
                    message={message}
                    viewer="customer"
                    otherName={contact}
                    meetings={meetings}
                  />
                ) : null
            : undefined
        }
      />
    </div>
  );
}
