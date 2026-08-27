"use client";

import { ChatThread } from "@/components/portal/chat-thread";
import { Badge } from "@/components/ui/badge";
import { customerApi } from "@/lib/customer";

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
  conversationId,
}: {
  workspace: string;
  contact: string;
  /** Threaded through so opening the pane clears the unread badge. */
  conversationId: string | null;
}) {
  return (
    // The shell pads the page; the pane takes what is left of the viewport so
    // the thread scrolls inside itself rather than growing the page.
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-4">
      <h1 className="font-semibold">Chat</h1>

      <ChatThread
        contact={contact}
        badge={<Badge variant="secondary">Accounting Manager</Badge>}
        conversationId={conversationId}
        load={() => customerApi.messages(workspace)}
        send={(body) => customerApi.sendMessage(workspace, body)}
        sendFile={(file) => customerApi.sendAttachment(workspace, file)}
      />
    </div>
  );
}
