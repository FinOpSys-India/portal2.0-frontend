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
 * Built ahead of the backend (list #10): every route below is the shape we
 * asked Pratibha for, not one read off her code. Behind
 * `NEXT_PUBLIC_ASSISTANT=on` until it is deployed: see `assistantEnabled`.
 *
 * Every route takes `?companyId=`, as the meeting routes do, and only ever
 * answers with the caller's own chats and documents the caller can already see.
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
  /** How many files the search looked through, when the server says. */
  searched: number | null;
}

export interface Conversation {
  id: string;
  title: string;
  /** ISO instant of the last message: what the history list sorts and groups by. */
  updatedAt: string;
}

interface BackendConversation {
  id: number;
  title: string;
  updatedAt: string;
}

interface BackendAssistantMessage {
  id: number;
  role: "USER" | "ASSISTANT";
  text: string;
  documents?: (BackendDocument & { service?: string | null })[];
  searchedCount?: number | null;
}

const toConversation = (c: BackendConversation): Conversation => ({
  id: String(c.id),
  title: c.title,
  updatedAt: c.updatedAt,
});

export function toAssistantMessage(m: BackendAssistantMessage): AssistantMessage {
  return {
    id: String(m.id),
    role: m.role === "USER" ? "user" : "assistant",
    text: m.text,
    documents: (m.documents ?? []).map((d) => ({
      id: String(d.id),
      projectId: documentProjectId(d),
      name: d.fileName,
      project: d.project?.projectName ?? null,
      service: d.service ?? null,
      owner: personName(d.uploadedBy),
      uploadedAt: usDate(d.createdAt),
      size: d.sizeBytes,
    })),
    searched: m.searchedCount ?? null,
  };
}

const scope = (companyId: string) =>
  `companyId=${encodeURIComponent(companyId)}`;
const one = (id: string) =>
  `/assistant/conversations/${encodeURIComponent(id)}`;

export const assistantApi = {
  /** The caller's chats on this company, newest first. */
  async list(companyId: string): Promise<Conversation[]> {
    const data = await get<{ conversations: BackendConversation[] }>(
      `/assistant/conversations?${scope(companyId)}`,
    );
    return data.conversations.map(toConversation);
  },

  async read(companyId: string, id: string): Promise<AssistantMessage[]> {
    const data = await get<{ messages: BackendAssistantMessage[] }>(
      `${one(id)}?${scope(companyId)}`,
    );
    return data.messages.map(toAssistantMessage);
  },

  /**
   * Ask. With no `conversationId` the server starts a chat, named after the
   * question, and answers with it; otherwise the reply reads the earlier
   * messages, so "just the federal one" narrows the last answer.
   */
  async send(
    companyId: string,
    message: string,
    conversationId: string | null,
  ): Promise<{ conversation: Conversation; reply: AssistantMessage }> {
    const data = await post<{
      conversation: BackendConversation;
      reply: BackendAssistantMessage;
    }>(`/assistant/messages?${scope(companyId)}`, {
      message,
      ...(conversationId ? { conversationId: Number(conversationId) } : {}),
    });
    return {
      conversation: toConversation(data.conversation),
      reply: toAssistantMessage(data.reply),
    };
  },

  async rename(companyId: string, id: string, title: string): Promise<void> {
    await patch(`${one(id)}?${scope(companyId)}`, { title });
  },

  /** Permanent, like every other delete in the portal. The documents stay. */
  async remove(companyId: string, id: string): Promise<void> {
    await del(`${one(id)}?${scope(companyId)}`);
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
