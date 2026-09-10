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

import { del, get, post } from "@/lib/http";
import {
  personName,
  toChatMessage,
  type BackendConversation,
  type BackendMessage,
} from "@/lib/portal";
import type { ChatMessage } from "@/lib/manager";
import type { MessageReaction } from "@/lib/reactions";

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

/* --------------------------------------------------------------- unread -- */

/** One thread with something in it the reader has not seen. */
export interface UnreadThread {
  conversationId: string;
  companyId: string;
  /** Named on every row, because the bell merges several companies into one list. */
  company: string;
  /** The person on the other end. */
  contact: string;
  /** The last thing they said, for a row that says what arrived. */
  preview: string;
  unread: number;
  /** ISO instant, so the merged list can be ordered across companies. */
  at: string;
}

/**
 * Everything unread, across every company the reader holds.
 *
 * ONE REQUEST PER COMPANY, because `?companyId=` is required on chat with no
 * exemption — a thread list merged server-side would put two clients' people on
 * one response, which is the rule the whole feature turns on. The merge happens
 * here instead, where the reader's own company list is the scope.
 *
 * READ-ONLY, deliberately. The obvious alternative — `POST /chat/conversations`
 * per company, which is open-or-return — would CREATE a thread with every
 * counterparty just to draw a bell, on every render. A conversation with unread
 * messages in it necessarily already exists, so listing is both cheaper and the
 * only one of the two that cannot have side effects.
 *
 * A company whose list fails contributes nothing rather than failing the bell:
 * this is a dropdown in the chrome, and a 402 on one unpaid account must not
 * blank the notifications for the others.
 *
 * ponytail: N requests wide, bounded by how many companies one person holds.
 * A cross-company endpoint is the fix if that stops being a handful.
 */
export async function unreadThreads(
  companies: { id: string; name: string }[],
): Promise<UnreadThread[]> {
  const perCompany = await Promise.all(
    companies.map(async (company) => {
      const data = await get<{ conversations: BackendConversation[] }>(
        `/chat/conversations?companyId=${encodeURIComponent(company.id)}`,
      ).catch(() => ({ conversations: [] as BackendConversation[] }));

      return data.conversations
        .filter((row) => (row.unreadCount ?? 0) > 0)
        .map((row) => ({
          conversationId: String(row.id),
          companyId: company.id,
          company: row.companyName ?? company.name,
          contact: personName(row.counterpart),
          preview: row.lastMessage?.body ?? "",
          unread: row.unreadCount ?? 0,
          at: row.lastMessageAt ?? "",
        }));
    }),
  );

  // Newest first, across companies. ISO instants, so this is a text compare.
  return perCompany.flat().sort((a, b) => b.at.localeCompare(a.at));
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
    const data = await post<{ unreadCount: number }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/read`,
      {},
    );
    return data.unreadCount;
  },

  /** Everything unread across every thread on one company. The nav badge. */
  async unreadCount(companyId: string): Promise<number> {
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
    await del(`/chat/messages/${encodeURIComponent(messageId)}`);
  },

  /**
   * Add or remove the viewer's reaction. ONE ROUTE, NOT TWO: it toggles.
   *
   * A DELETE would have to carry the emoji anyway — a reactor can hold several
   * on one message, so "remove my reaction" is not a complete instruction — at
   * which point the pair is one endpoint written twice, and the client has to
   * know which of the two to call, which is a fact only the server's row
   * actually settles.
   *
   * What comes back is the message's WHOLE reaction list, regrouped. Not a
   * delta and not just the emoji that changed: somebody else's reaction can
   * land between the click and the answer, and a delta would render a count
   * this client computed rather than the one the database holds.
   */
  async react(messageId: string, emoji: string): Promise<MessageReaction[]> {
    const data = await post<{ reactions?: MessageReaction[] }>(
      `/chat/messages/${encodeURIComponent(messageId)}/reactions`,
      { emoji },
    );
    return data.reactions ?? [];
  },
};

/** Re-exported so a screen importing the thread's shape needs one import. */
export type { ChatMessage };
export { toChatMessage };
