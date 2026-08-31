"use client";

import { ChatThread } from "@/components/portal/chat-thread";
import { Badge } from "@/components/ui/badge";
import { specialistApi } from "@/lib/specialist";

/**
 * The specialist's chat: one pane, not the manager's two.
 *
 * There is exactly one counterparty, so a thread list would be a column of one
 * row that can never be deselected. No back button either — the shell derives
 * one for every inner page, and a second would be two controls doing the same
 * job.
 */
export function ManagerChat({
  contact,
  conversationId,
  companyId,
}: {
  contact: string;
  /** Threaded through so opening the pane clears the unread badge. */
  conversationId: string | null;
  /**
   * Which company this thread belongs to. Undefined only when the specialist
   * works none — otherwise the page above resolves the switcher's selection,
   * so both halves agree on which thread this is.
   */
  companyId?: string;
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
        load={() => specialistApi.messages(companyId)}
        send={(body) => specialistApi.sendMessage(body, companyId)}
        sendFile={(file) => specialistApi.sendAttachment(file, companyId)}
      />
    </div>
  );
}
