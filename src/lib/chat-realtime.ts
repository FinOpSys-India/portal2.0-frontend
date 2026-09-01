/**
 * Live chat, over Supabase Realtime.
 *
 * WHY THE BROWSER TALKS TO SUPABASE AND NOT TO OUR BACKEND. The API is
 * deployed to Vercel with a 10-second ceiling per request, so it cannot hold a
 * socket open — the connection would be cut mid-conversation every ten seconds.
 * Supabase Realtime already holds those sockets and already reads the Postgres
 * replication stream, so the path is:
 *
 *   POST /chat/.../messages -> Postgres WAL -> Supabase -> the other screen
 *
 * with this API nowhere in the live path. The one thing Supabase cannot work
 * out on its own is WHO is connecting: this app signs its own JWTs and does not
 * use Supabase Auth, so a socket opened with the publishable key alone arrives
 * anonymous and the RLS policies correctly show it nothing.
 *
 * `GET /chat/realtime-token` mints that bridge. It is signed with the SUPABASE
 * project secret rather than ours, so it opens nothing on our backend, and the
 * chat tables carry SELECT policies and no INSERT/UPDATE/DELETE policy at all —
 * a holder can watch their own threads and write nothing. Every write stays
 * behind the API, where the company-scope check lives.
 *
 * DEGRADES TO NOTHING. `SUPABASE_JWT_SECRET` has no default: unset, the token
 * endpoint answers 503 and live chat is simply off while REST chat keeps
 * working. Every failure here is swallowed for that reason — a thread that does
 * not update by itself is the state the app shipped in, and an error banner
 * over a working conversation would be worse than the silence.
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { get } from "@/lib/http";
import type { ChatMessage } from "@/lib/manager";

/** What `GET /chat/realtime-token` answers with. */
interface RealtimeTicket {
  token: string;
  expiresInSeconds: number;
  /** The project URL, echoed so one call carries everything the client needs. */
  url: string | null;
  /** The viewer, so an arriving row can be told from one of their own. */
  userId: number;
}

/**
 * A `chat_messages` row as the replication stream delivers it.
 *
 * SNAKE_CASE, AND NOT THE API'S SHAPE. This is the table, not a DTO: there is
 * no `mine`, no sender name, and no attachments — those are joins the socket
 * never performs. Mapping it is a second, separate translation from
 * `portal.toChatMessage`, and conflating the two is how the live path and the
 * loaded path drift apart.
 */
export interface ChatMessageRow {
  id: number | string;
  conversation_id: number;
  sender_user_id: number;
  body: string | null;
  created_at: string;
  deleted_at: string | null;
}

/**
 * The row, as the thread renders it.
 *
 * `attachments` is always empty and cannot be otherwise: `chat_attachments` is
 * NOT in the `supabase_realtime` publication, so the socket never learns a
 * message carried files. Callers use `needsReload` below to tell when the
 * payload is not the whole story.
 */
export function toLiveMessage(
  row: ChatMessageRow,
  viewerUserId: number,
): ChatMessage {
  return {
    id: String(row.id),
    mine: row.sender_user_id === viewerUserId,
    body: row.body ?? "",
    sentAt: row.created_at,
    attachments: [],
  };
}

/**
 * True when the socket cannot describe this message on its own.
 *
 * A NULL body means the message carried only files — the one case the payload
 * gets provably wrong, because it would render as an empty bubble. The caller
 * refetches instead.
 *
 * ponytail: a message with BOTH text and files shows its text instantly and its
 * files on the next load, because nothing in the payload says the files exist.
 * Fixing it properly means adding `chat_attachments` to the publication, which
 * is a backend change.
 */
export function needsReload(row: ChatMessageRow): boolean {
  return row.body === null;
}

export interface LiveHandlers {
  /** A message that arrived complete. Append it. */
  onMessage: (message: ChatMessage) => void;
  /** The payload was not the whole story — refetch the thread. */
  onReload: () => void;
  /** A message was removed (soft-deleted) by whoever sent it. */
  onDelete: (messageId: string) => void;
}

/**
 * Watch one thread.
 *
 * Returns the teardown when a channel was actually opened, and NULL when one
 * could not be — no Supabase key in the environment, no project secret on the
 * backend, no browser. The distinction is the caller's cue to fall back to
 * polling: swallowing it and handing back a no-op teardown made "live chat is
 * switched off" indistinguishable from "live chat is running", so the other
 * portal's message sat unseen until someone reloaded the page.
 */
export async function subscribeToThread(
  conversationId: string,
  handlers: LiveHandlers,
): Promise<(() => void) | null> {
  if (typeof window === "undefined") return null;

  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) return null;

  let ticket: RealtimeTicket;
  try {
    ticket = await get<RealtimeTicket>("/chat/realtime-token");
  } catch {
    // 503 when the project secret is unset — live chat is off by configuration,
    // not broken. REST chat is unaffected.
    return null;
  }

  const projectUrl = ticket.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl || !ticket.token) return null;

  // Imported here rather than at module scope so the client bundle only pays
  // for it on a screen that actually opens a thread.
  const { createClient } = await import("@supabase/supabase-js");
  const client: SupabaseClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  client.realtime.setAuth(ticket.token);

  const channel: RealtimeChannel = client
    .channel(`chat:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        // Server-side, so another thread's traffic never reaches this socket.
        filter: `conversation_id=eq.${conversationId}`,
      },
      ({ new: row }) => {
        const message = row as ChatMessageRow;
        if (needsReload(message)) handlers.onReload();
        else handlers.onMessage(toLiveMessage(message, ticket.userId));
      },
    )
    .on(
      "postgres_changes",
      {
        // A delete is a soft delete — `deleted_at` is stamped — so it arrives as
        // an UPDATE, never as a DELETE. `REPLICA IDENTITY FULL` is set on the
        // table, which is what makes the whole row available here.
        event: "UPDATE",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      ({ new: row }) => {
        const message = row as ChatMessageRow;
        if (message.deleted_at) handlers.onDelete(String(message.id));
      },
    )
    .subscribe();

  /*
   * The token is good for thirty minutes. Re-minted at eighty percent of that
   * so a reader in a long conversation is never dropped mid-thread — the socket
   * survives, only its credential is replaced.
   */
  const renewAt = Math.max(30, ticket.expiresInSeconds * 0.8) * 1000;
  const timer = setInterval(async () => {
    try {
      const next = await get<RealtimeTicket>("/chat/realtime-token");
      client.realtime.setAuth(next.token);
    } catch {
      // Leave the existing token in place. It is still valid for the remaining
      // twenty percent, and the next tick may well succeed.
    }
  }, renewAt);

  return () => {
    clearInterval(timer);
    client.removeChannel(channel);
  };
}
