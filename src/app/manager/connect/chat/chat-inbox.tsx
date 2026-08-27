"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { ChatThread } from "@/components/portal/chat-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatContact } from "@/lib/chat";
import { managerApi, type Party } from "@/lib/manager";
import { cn } from "@/lib/utils";

/**
 * The manager's inbox.
 *
 * BUILT FROM PEOPLE, NOT FROM THREADS, and that is the fix. It used to render
 * `GET /chat/conversations`, which returns only threads that already exist — so
 * everyone who had never been written to was missing from the list, and there
 * was no way to start a first conversation with them at all. `GET
 * /chat/contacts/...` returns every person on the company, with
 * `conversationId: null` for the ones nobody has messaged yet.
 *
 * Opening such a row calls `POST /chat/conversations`, which is open-or-return.
 * The id it hands back is stored against that contact, so the thread behaves
 * like any other from the moment it exists.
 */
export function ChatInbox({
  contacts,
  party,
  companyId,
  backHref,
}: {
  contacts: ChatContact[];
  party: Party;
  companyId?: string;
  backHref: string;
}) {
  const [rows, setRows] = React.useState(contacts);
  const [openUserId, setOpenUserId] = React.useState<number | null>(null);
  const [opening, setOpening] = React.useState(false);

  const open = rows.find((c) => c.userId === openUserId) ?? null;

  async function select(contact: ChatContact) {
    setOpenUserId(contact.userId);
    if (contact.conversationId || !companyId) return;

    // No thread yet. Create it now rather than on the first send, so the
    // composer has somewhere to post to the moment the pane appears.
    setOpening(true);
    try {
      const id = await managerApi.openThread(companyId, contact.userId);
      setRows((all) =>
        all.map((c) =>
          c.userId === contact.userId ? { ...c, conversationId: id } : c,
        ),
      );
    } finally {
      setOpening(false);
    }
  }

  /** A read receipt came back, so the row's badge is no longer accurate. */
  function clearBadge(userId: number) {
    setRows((all) =>
      all.map((c) => (c.userId === userId ? { ...c, unread: 0 } : c)),
    );
  }

  return (
    // The shell pads the page; the panes take what is left of the viewport so
    // the thread scrolls inside itself rather than growing the page.
    <div className="flex h-[calc(100dvh-7rem)] gap-4">
      <ContactList
        contacts={rows}
        backHref={backHref}
        openUserId={openUserId}
        onOpen={select}
      />

      {open && open.conversationId ? (
        <ChatThread
          key={open.conversationId}
          contact={open.name}
          badge={
            <Badge variant="secondary" className="capitalize">
              {open.roleLabel || party}
            </Badge>
          }
          conversationId={open.conversationId}
          onRead={() => clearBadge(open.userId)}
          load={() => managerApi.messages(open.conversationId!)}
          send={(body) => managerApi.sendMessage(open.conversationId!, body)}
          sendFile={(file) =>
            managerApi.sendAttachment(open.conversationId!, file)
          }
        />
      ) : (
        <p className="m-auto text-sm text-muted-foreground">
          {opening
            ? "Opening…"
            : open
              ? "Starting a conversation…"
              : "Select someone to open a chat."}
        </p>
      )}
    </div>
  );
}

/** Left pane: `Chat`, the count, and one row per person on the company. */
function ContactList({
  contacts,
  backHref,
  openUserId,
  onOpen,
}: {
  contacts: ChatContact[];
  backHref: string;
  openUserId: number | null;
  onOpen: (contact: ChatContact) => void;
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={backHref} aria-label="Back to Connect">
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <div>
          <h1 className="font-semibold">Chat</h1>
          {/* 1.0 prints "N Chat found" at every count. Pluralised here. */}
          <p className="text-sm text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "Chat" : "Chats"} found
          </p>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {contacts.map((contact) => (
          <li key={contact.userId}>
            <button
              type="button"
              onClick={() => onOpen(contact)}
              aria-current={contact.userId === openUserId}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-muted",
                contact.userId === openUserId && "bg-muted",
              )}
            >
              <InitialsAvatar name={contact.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {contact.name}
                </span>
                {/* Someone never messaged has no last line to show. Saying so
                    is what makes the row read as "startable" rather than as a
                    thread that failed to load. */}
                <span className="block truncate text-xs text-muted-foreground">
                  {contact.lastMessage || "No messages yet"}
                </span>
              </span>
              {/* 1.0 shows no unread count. The Connect cards already surface
                  one, and a thread owing a reply is worth marking. */}
              {contact.unread > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {contact.unread}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {contacts.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          Nobody on this company yet.
        </p>
      ) : null}
    </div>
  );
}
