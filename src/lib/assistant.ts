import { del, get, patch, post } from "@/lib/http";
import {
  documentProjectId,
  personName,
  usDate,
  type BackendDocument,
} from "@/lib/portal";

/**
 * The customer's AI document finder (feature 6): a chat that finds files in the
 * company the customer has open, from file details only. No document content
 * and no financial data go to the model (Sir, Q24); that is the backend's rule
 * to keep, and the window says it.
 *
 * Wired to Pratibha's `/ai-assistant` routes (list #10, samples shared Nov 27,
 * not deployed yet). Behind `NEXT_PUBLIC_ASSISTANT=on` until they are: see
 * `assistantEnabled`.
 *
 * Asking and listing name the company; a chat's own routes go by its id, and
 * the backend answers only with the caller's own chats and documents the
 * caller can already see.
 */

/** The flag. `NEXT_PUBLIC_` because the shell that draws the button is a client component. */
export function assistantEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ASSISTANT === "on";
}

export interface AssistantDocument {
  id: string;
  /** Half of the download URL — see `documentPath`. */
  projectId: string | null;
  name: string;
  project: string | null;
  service: string | null;
  owner: string;
  uploadedAt: string;
  size: number;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** The files the reply points at; empty on the customer's own messages. */
  documents: AssistantDocument[];
  /** How many documents matched; can exceed `documents` when the reply shows a batch. */
  found: number | null;
}

export interface Conversation {
  id: string;
  title: string;
  /** ISO instant of the last message: what the history list sorts and groups by. */
  updatedAt: string;
}

interface BackendConversation {
  id: number;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

/** A document row as the assistant returns it: the project carries the service. */
interface BackendAssistantDocument
  extends Omit<BackendDocument, "uploadedBy" | "project"> {
  uploadedBy?: BackendDocument["uploadedBy"];
  project?: { id: number; projectName: string; service?: string | null } | null;
}

interface BackendAssistantMessage {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  documents?: BackendAssistantDocument[];
  total?: number | null;
}

/** The answer to a question, as `POST /ai-assistant/query` returns it. */
interface BackendAnswer {
  conversationId: number;
  answer: string;
  documents: BackendAssistantDocument[];
  total: number;
}

// Not `updatedAt`: a rename bumps that, and a renamed chat hasn't moved.
const toConversation = (c: BackendConversation): Conversation => ({
  id: String(c.id),
  title: c.title || "New chat",
  updatedAt: c.lastMessageAt ?? c.createdAt,
});

const toAssistantDocument = (d: BackendAssistantDocument): AssistantDocument => ({
  id: String(d.id),
  projectId: documentProjectId(d),
  name: d.fileName,
  project: d.project?.projectName ?? null,
  service: d.project?.service ?? null,
  // No uploader on these rows yet (asked under #10); the card leaves it out.
  owner: personName(d.uploadedBy),
  uploadedAt: usDate(d.createdAt),
  size: d.sizeBytes,
});

export function toAssistantMessage(m: BackendAssistantMessage): AssistantMessage {
  return {
    id: String(m.id),
    role: m.role === "user" ? "user" : "assistant",
    text: m.content,
    documents: (m.documents ?? []).map(toAssistantDocument),
    found: m.role === "user" ? null : (m.total ?? null),
  };
}

const one = (id: string) =>
  `/ai-assistant/conversations/${encodeURIComponent(id)}`;

export const assistantApi = {
  /** The caller's chats on this company, newest first. */
  async list(companyId: string): Promise<Conversation[]> {
    // ponytail: first 20 chats only (her sample's page); page with `offset` once people have more.
    const data = await get<
      BackendConversation[] | { conversations: BackendConversation[] }
    >(`/ai-assistant/conversations?companyId=${encodeURIComponent(companyId)}&limit=20&offset=0`);
    // The list's shape wasn't in the samples; take either an array or a wrapper.
    return (Array.isArray(data) ? data : data.conversations).map(toConversation);
  },

  /** The chat's messages, oldest first. */
  async read(id: string): Promise<AssistantMessage[]> {
    // ponytail: newest 100 messages; older ones need `before=<nextBefore>` paging.
    const data = await get<{ messages: BackendAssistantMessage[] }>(
      `${one(id)}?limit=100`,
    );
    return data.messages.map(toAssistantMessage);
  },

  /**
   * Ask. With no `conversationId` the server starts a chat, named after the
   * question; otherwise the reply reads the earlier messages, so "just the
   * federal one" narrows the last answer.
   */
  async send(
    companyId: string,
    message: string,
    conversationId: string | null,
  ): Promise<{ conversationId: string; reply: AssistantMessage }> {
    const data = await post<BackendAnswer>("/ai-assistant/query", {
      companyId: Number(companyId),
      message,
      ...(conversationId ? { conversationId: Number(conversationId) } : {}),
    });
    return {
      conversationId: String(data.conversationId),
      reply: toAssistantMessage({
        // The answer carries no message id; this one only has to be unique on screen.
        id: `reply-${data.conversationId}-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        documents: data.documents,
        total: data.total,
      }),
    };
  },

  async rename(id: string, title: string): Promise<void> {
    await patch(one(id), { title });
  },

  /** Permanent, like every other delete in the portal. The documents stay. */
  async remove(id: string): Promise<void> {
    await del(one(id));
  },
};

/* --------------------------------------------------------------- history -- */

export type HistoryGroup = "Today" | "Yesterday" | "Previous 7 Days" | "Older";

/** Whole local calendar days between two instants: 0 today, 1 yesterday. */
function daysAgo(iso: string, now: Date): number {
  const at = new Date(iso);
  const start = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(now) - start(at)) / 86_400_000);
}

/**
 * The history list's sections, in order, each holding its chats newest first.
 * Grouped by the reader's own calendar day, so a chat from 11 PM is
 * "Yesterday" the next morning whatever the gap in hours.
 */
export function historyGroups(
  conversations: Conversation[],
  now: Date = new Date(),
): { group: HistoryGroup; conversations: Conversation[] }[] {
  const order: HistoryGroup[] = ["Today", "Yesterday", "Previous 7 Days", "Older"];
  const groupOf = (c: Conversation): HistoryGroup => {
    const days = daysAgo(c.updatedAt, now);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    return days <= 7 ? "Previous 7 Days" : "Older";
  };
  const sorted = [...conversations].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  return order
    .map((group) => ({
      group,
      conversations: sorted.filter((c) => groupOf(c) === group),
    }))
    .filter((g) => g.conversations.length > 0);
}

/** A row's time: the clock today, else the day ("Nov 24"), with the year once it differs. */
export function historyWhen(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (daysAgo(iso, now) <= 0) {
    return at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}
