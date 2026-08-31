/**
 * The chat endpoints that no screen was calling.
 *
 * Threads, messages and uploads already run through lib/manager.ts, because the
 * manager's inbox owns them. What lives here is everything the portals render
 * but could not act on: the contact lists a first conversation is started from,
 * the signed link an attachment is actually opened with, the read receipt that
 * clears a badge, and the delete a sender is allowed to perform.
 *
 * ONE FILE FOR THREE PORTALS. Every route below is scope-checked server-side
 * against the caller being a side of the thread (`chatService.assertParticipant`)
 * rather than against a role, so the manager, the customer and the specialist
 * call exactly the same paths. An ADMIN reaches none of it — not by a role gate,
 * but because an admin is never one of a conversation's two sides.
 */

import { BASE, del, get, post } from "@/lib/http";
import { personName, toChatMessage, type BackendMessage } from "@/lib/portal";
import type { ChatMessage } from "@/lib/manager";

/* -------------------------------------------------------------- contacts -- */

/**
 * One person a manager could be talking to on this company.
 *
 * THE PERSON IS THE ROW, NOT THE THREAD — which is the whole reason this
 * endpoint exists. The inbox was built from `GET /chat/conversations`, so it
 * listed only threads that already had messages: everyone who had never been
 * written to was invisible, and there was no way to start a first conversation
 * with them. Those people come back here with `conversationId: null`.
 */
export interface ChatContact {
  userId: number;
  name: string;
  email: string | null;
  /** "Owner" / "Team" for a customer; the service lines covered for a specialist. */
  roleLabel: string;
  /** Null until the first message — clicking such a row opens the thread. */
  conversationId: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

interface BackendContact {
  /**
   * `id`, not `userId`. A contact row is a PERSON — chatDto spreads
   * `projectDto.toPerson` into it, and that shape names the key `id`, unlike the
   * directory rows everywhere else in this app. Reading `userId` here got
   * `undefined` on every row: React warned that the list had no keys, the open
   * thread matched whichever row was first, and clicking one asked the backend
   * to open a conversation with nobody.
   */
  id: number;
  /** Still accepted, for a deployment that answers with the directory shape. */
  userId?: number;
  firstName: string;
  lastName: string;
  email: string | null;
  roleLabel: string | null;
  specializations: { specializationName: string | null }[];
  conversationId: number | null;
  lastMessageAt: string | null;
  lastMessage: BackendMessage | null;
  unreadCount: number;
}

export function toContact(c: BackendContact): ChatContact {
  return {
    userId: c.userId ?? c.id,
    name: personName(c),
    email: c.email,
    roleLabel:
      c.roleLabel ??
      c.specializations.map((s) => s.specializationName).filter(Boolean).join(", "),
    conversationId: c.conversationId === null ? null : String(c.conversationId),
    lastMessage: c.lastMessage?.body ?? "",
    lastMessageAt: c.lastMessageAt ?? "",
    unread: c.unreadCount ?? 0,
  };
}

export const chatApi = {
  /**
   * Who the manager could chat with on one company, by side of the account.
   *
   * ACCOUNTING_MANAGER only — the one role gate on this feature, and it is on
   * the two lists that answer "who could I start a chat with". Nobody else has
   * that choice: a customer and a specialist each have exactly one counterpart,
   * which `POST /chat/conversations` resolves from the company alone.
   */
  async contacts(
    companyId: string,
    kind: "customer" | "specialist",
  ): Promise<ChatContact[]> {
    if (!BASE) return mock.contacts(kind);
    const scope = `companyId=${encodeURIComponent(companyId)}`;
    const data = await get<{ contacts: BackendContact[] }>(
      `/chat/contacts/${kind === "specialist" ? "specialists" : "customers"}?${scope}`,
    );
    return data.contacts.map(toContact);
  },

  /**
   * A short-lived signed link to one attachment.
   *
   * Fetched on click rather than rendered with the message: the link expires in
   * about a minute, so one minted when the thread loaded would be dead before
   * anyone reached the bottom of it.
   */
  async downloadUrl(attachmentId: number): Promise<string> {
    if (!BASE) return mock.downloadUrl();
    const data = await get<{ url: string }>(
      `/chat/attachments/${attachmentId}/download-url`,
    );
    return data.url;
  },

  /**
   * Clear the badge on a thread the viewer has just read.
   *
   * `upToMessageId` is omitted, which marks everything currently unread — the
   * screen shows the whole thread at once, so "up to here" and "all of it" are
   * the same statement.
   */
  async markRead(conversationId: string): Promise<number> {
    if (!BASE) return mock.zero();
    const data = await post<{ unreadCount: number }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/read`,
      {},
    );
    return data.unreadCount;
  },

  /** Everything unread across every thread on one company. The nav badge. */
  async unreadCount(companyId: string): Promise<number> {
    if (!BASE) return mock.zero();
    const data = await get<{ unreadCount: number }>(
      `/chat/unread-count?companyId=${encodeURIComponent(companyId)}`,
    );
    return data.unreadCount;
  },

  /**
   * Remove one of your OWN messages. The server refuses anything else with
   * CHAT_MESSAGE_DELETE_FORBIDDEN, so the control is only offered where `mine`
   * is true — the check here is the courtesy, the one there is the rule.
   */
  async deleteMessage(messageId: string): Promise<void> {
    if (!BASE) return mock.ok();
    await del(`/chat/messages/${encodeURIComponent(messageId)}`);
  },
};

/** Re-exported so a screen importing the thread's shape needs one import. */
export type { ChatMessage };
export { toChatMessage };

/* ---------------------------------------------------------------- mock ---- */

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

const CONTACTS: Record<"customer" | "specialist", ChatContact[]> = {
  customer: [
    {
      userId: 21,
      name: "Priya Nair",
      email: "priya.nair@example.com",
      roleLabel: "Owner",
      conversationId: "c-1",
      lastMessage: "Thanks, that clears it up.",
      lastMessageAt: new Date().toISOString(),
      unread: 2,
    },
    {
      // Never messaged. The case the contacts endpoint exists for, and the one
      // the conversations-only inbox could not show at all.
      userId: 22,
      name: "Tom Becker",
      email: "tom.becker@example.com",
      roleLabel: "Team",
      conversationId: null,
      lastMessage: "",
      lastMessageAt: "",
      unread: 0,
    },
  ],
  specialist: [
    {
      userId: 31,
      name: "Rosa Delgado",
      email: "rosa.delgado@finopsys.ai",
      roleLabel: "Payroll",
      conversationId: "c-2",
      lastMessage: "Payroll register is ready for your review.",
      lastMessageAt: new Date().toISOString(),
      unread: 0,
    },
  ],
};

const mock = {
  async contacts(kind: "customer" | "specialist"): Promise<ChatContact[]> {
    await delay();
    return CONTACTS[kind];
  },

  async downloadUrl(): Promise<string> {
    await delay();
    // Nowhere real to point without storage. Returning "" lets the caller show
    // its own failure rather than navigating to a broken tab.
    return "";
  },

  async zero(): Promise<number> {
    await delay();
    return 0;
  },

  async ok(): Promise<void> {
    await delay();
  },
};
