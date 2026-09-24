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
/** The columns `loadTombstones` asks for — no `body`, by design. */
interface TombstoneRow {
  id: number | string;
  sender_user_id: number;
  created_at: string;
}

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
    // Empty for the same reason, and it is not a gap worth closing here: a
    // message arriving over the socket is one nobody can have reacted to yet.
    reactions: [],
    // The soft delete arrives as an UPDATE on this table, so unlike the two
    // fields above this one the socket CAN describe on its own — it is the
    // whole reason the other side's tombstone appears without a reload.
    deleted: Boolean(row.deleted_at),
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

/**
 * Replace a thread's rows with a fresh read WITHOUT losing the tombstones.
 *
 * WHY THIS HAS TO EXIST. `chatRepository.listMessages` filters `deletedAt:
 * null`, so a deleted message does not come back from the API at all — see the
 * note on `deletedAt` in `BackendMessage`. Every re-read therefore erased the
 * bubble that said "This message was deleted" and shifted the thread up, which
 * is precisely the disappearing-message behaviour the tombstone exists to
 * prevent. With no Supabase key in the bundle that re-read is an 8s poll, so
 * the other side's delete produced no tombstone at all: the bubble was simply
 * gone the next time the timer fired.
 *
 * ABSENCE INSIDE THE WINDOW IS THE DELETE. A row this tab already holds, that
 * the new page does not, and whose `sentAt` falls between the page's oldest and
 * newest rows, was deleted between the two reads. The two bounds are what keep
 * the inference honest:
 *
 * - older than the oldest returned row — it paged out (the thread reads
 *   `limit=50`), so it is dropped as before rather than turned into a lie.
 * - newer than the newest returned row — it arrived after the page was
 *   fetched, over the socket or from this tab's own send, and the poll simply
 *   has not caught up. Marking that one deleted would tombstone a message
 *   nobody touched.
 *
 * ponytail: inferred from absence, and only for a thread this tab has watched.
 * A message deleted before the thread was opened cannot be shown at all from
 * here — that needs `listMessages` to return deleted rows with `body` and
 * `attachments` stripped, which is the backend half of this.
 */
export function keepTombstones(
  rows: ChatMessage[],
  known: ChatMessage[] | null,
): ChatMessage[] {
  if (!rows.length || !known?.length) return rows;

  const fresh = new Set(rows.map((m) => m.id));
  // Oldest first, the order the thread renders in and the loader returns.
  const oldest = rows[0].sentAt;
  const newest = rows[rows.length - 1].sentAt;

  const gone = known
    .filter(
      (m) => !fresh.has(m.id) && m.sentAt >= oldest && m.sentAt <= newest,
    )
    // Cleared the same way the socket and the sender's own click clear it:
    // nothing that was in the message survives in this tab's memory.
    .map((m) => ({
      ...m,
      deleted: true,
      body: "",
      attachments: [],
      reactions: [],
    }));

  if (!gone.length) return rows;
  return [...rows, ...gone].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export interface LiveHandlers {
  /** A message that arrived complete. Append it. */
  onMessage: (message: ChatMessage) => void;
  /** The payload was not the whole story — refetch the thread. */
  onReload: () => void;
  /** A message was removed (soft-deleted) by whoever sent it. */
  onDelete: (messageId: string) => void;
  /**
   * Whether the channel is actually delivering. A channel that opens and then
   * errors is the one failure this file used to hide: `subscribeToThread`
   * resolved with a teardown either way, so the caller believed it was live and
   * never fell back — and the thread sat dead until someone reloaded the page.
   */
  onHealth?: (healthy: boolean) => void;
}

/**
 * Poll only while the socket is not delivering.
 *
 * Wired to `onHealth`, so the timer exists exactly when the channel does not:
 * no Supabase keys at all, a token Realtime refuses, or a channel that opened
 * and then dropped. Feeding both paths through one gate is what keeps a
 * reconnect from leaving two readers of the same thread running.
 *
 * THE RELOAD ON RECOVERY IS NOT OPTIONAL. Realtime replays nothing it missed
 * while the channel was down, so the rows that landed in the gap between the
 * last poll and the re-subscribe would never arrive on their own.
 */
export function pollWhileOffline(
  reload: () => void,
  everyMs = 8_000,
): { onHealth: (healthy: boolean) => void; stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    onHealth(healthy) {
      if (!healthy) {
        // Already polling: a second CHANNEL_ERROR must not start a second timer.
        if (!timer) timer = setInterval(reload, everyMs);
        return;
      }
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      reload();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

/**
 * One authenticated Supabase client, plus who the token says is asking.
 *
 * NULL when live chat cannot run at all: no publishable key in this bundle, no
 * project secret on the backend (the token endpoint answers 503), or no
 * browser. Both readers below treat that as "this feature is off" rather than
 * as an error.
 */
/** Just the hostname, for comparing two project URLs without tripping on a trailing slash. */
function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Whether two Supabase project URLs name the same project.
 *
 * Compared by HOST, because the two sides are written by different hands: the
 * backend echoes its project URL on the ticket, this bundle carries one in an
 * env var, and a trailing slash or a `http`/`https` difference between them is
 * not a different project. A malformed value compares as itself rather than
 * throwing — an unparseable URL is a mismatch, which is the safe answer.
 *
 * Exported for the test.
 */
export function sameProject(a: string, b: string): boolean {
  return host(a) === host(b);
}

async function connect(): Promise<{
  client: SupabaseClient;
  ticket: RealtimeTicket;
} | null> {
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

  /*
   * TWO HALVES OF ONE PROJECT, OR NOTHING.
   *
   * The host comes from the BACKEND (`ticket.url`, its own Supabase project);
   * the publishable key comes from THIS bundle. Point them at different
   * projects and every symptom is a lie: the token mints 200, the socket opens,
   * and then the server refuses it — `HTTP Authentication failed; no valid
   * credentials available` — and the client retries on a backoff forever,
   * because a refused credential looks exactly like a flaky network from here.
   *
   * Seen on a real deployment: the backend signed for one project while the
   * preview carried another project's key, and the page sat in a permanent
   * retry loop nobody could read from the UI.
   *
   * So it is checked before the socket is opened. A mismatch is a configuration
   * fault, not a runtime one, and the honest answer is the same as "live chat
   * is off": return null, let the caller fall back to its poll, and say why
   * once instead of failing every few seconds in silence.
   */
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configured && !sameProject(projectUrl, configured)) {
    console.error(
      `[chat] Live chat is off: the backend signs realtime tokens for ${host(projectUrl)} ` +
        `but this build carries the publishable key for ${host(configured)}. ` +
        `Point NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY at the ` +
        `same project the backend's SUPABASE_JWT_SECRET belongs to. Falling back to polling.`,
    );
    return null;
  }

  // Imported here rather than at module scope so the client bundle only pays
  // for it on a screen that actually opens a thread.
  const { createClient } = await import("@supabase/supabase-js");
  const client: SupabaseClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${ticket.token}` } },
  });

  client.realtime.setAuth(ticket.token);

  return { client, ticket };
}

/**
 * A thread's deleted messages, straight from the database.
 *
 * WHY THIS DOES NOT COME FROM THE API. `chatRepository.listMessages` filters
 * `deletedAt: null`, so a deleted row is not in the page the thread loads —
 * which is why the tombstone used to live only in the tab that watched the
 * delete happen and vanished on reload. The same RLS policy that feeds the
 * socket also covers this read, so the browser can ask for what the API drops.
 *
 * `body` IS DELIBERATELY NOT SELECTED. The bubble says a message was deleted
 * and nothing else, so there is no reason to carry its text into the tab —
 * this returns ids and timestamps, which is all a tombstone renders from.
 *
 * ponytail: a second read path against the same rows, and it exists only
 * because the API cannot currently answer this. Drop it the day `listMessages`
 * returns deleted rows with their body and attachments stripped server-side.
 */
export async function loadTombstones(
  conversationId: string,
): Promise<ChatMessage[]> {
  const live = await connect();
  if (!live) return [];

  const { data, error } = await live.client
    .from("chat_messages")
    .select("id,sender_user_id,created_at")
    .eq("conversation_id", conversationId)
    .not("deleted_at", "is", null)
    .order("created_at", { ascending: true })
    // The thread reads 50; this is headroom over that and a bound on a thread
    // somebody has been deleting in for a year.
    .limit(200);

  // Swallowed like every other failure here: a thread that draws no tombstones
  // is the state the app shipped in, and it is not worth an error over.
  if (error || !data) return [];

  return (data as TombstoneRow[]).map((row) => ({
    id: String(row.id),
    mine: row.sender_user_id === live.ticket.userId,
    body: "",
    sentAt: row.created_at,
    attachments: [],
    reactions: [],
    deleted: true,
  }));
}

/**
 * Put the fetched tombstones back into a freshly loaded page.
 *
 * NOT `keepTombstones`, and the difference is the upper bound. That one infers
 * a delete from a row's ABSENCE and must therefore refuse to touch anything
 * newer than the page it was handed — a message that arrived mid-poll is absent
 * for an innocent reason. These rows are not inferred: the database said they
 * are deleted. The newest message in a thread is a common one to delete, so
 * bounding them by the newest live row would drop exactly that case.
 *
 * The lower bound stays: a tombstone older than the oldest row on screen
 * belongs to a page this thread has not loaded (`limit=50`), and hanging it
 * under the last fifty messages would put it in the wrong place entirely.
 */
export function mergeTombstones(
  rows: ChatMessage[],
  tombstones: ChatMessage[],
): ChatMessage[] {
  if (!tombstones.length) return rows;

  const have = new Set(rows.map((m) => m.id));
  // No live rows at all: a thread whose every message was deleted still has to
  // show that something was there.
  const oldest = rows.length ? rows[0].sentAt : null;

  const missing = tombstones.filter(
    (t) => !have.has(t.id) && (!oldest || t.sentAt >= oldest),
  );
  if (!missing.length) return rows;

  return [...rows, ...missing].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
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

/*
 * ONE CLIENT AND ONE TOKEN PER PAGE, however many threads subscribe.
 *
 * `connect()` mints a token and builds a Supabase client every time it is
 * called, and the thread's effect can run more than once for a single open
 * thread — it did on a real deployment, producing two `GET /chat/realtime-token`
 * calls, two clients, and the browser's own complaint: "Multiple GoTrueClient
 * instances detected in the same browser context." One of each was orphaned:
 * still holding a credential, still renewing it, delivering nothing.
 *
 * So the connection is shared and reference-counted rather than the effect being
 * made clever. Whatever causes a second subscribe — a remount, a Suspense
 * boundary resolving, a second thread on one screen — it joins the existing
 * client instead of building another.
 *
 * REFERENCE COUNTED, NOT CACHED FOREVER. The last subscriber to leave tears the
 * client down and drops the token. A module-level cache that outlived its
 * subscribers would leave a signed credential alive in the tab after the reader
 * closed the thread, which is the one thing a shared client must not do.
 */
let shared: {
  promise: Promise<{ client: SupabaseClient; ticket: RealtimeTicket } | null> | null;
  timer: ReturnType<typeof setInterval> | null;
  refs: number;
} = { promise: null, timer: null, refs: 0 };

async function acquire() {
  shared.refs += 1;

  if (!shared.promise) {
    shared.promise = connect().then((live) => {
      if (!live) return null;

      /*
       * The token is good for thirty minutes. Re-minted at eighty percent of
       * that so a reader in a long conversation is never dropped mid-thread —
       * the socket survives, only its credential is replaced.
       *
       * One timer for the shared client, not one per subscriber: two threads on
       * screen used to mean two renewals racing to set the same auth.
       */
      const renewAt = Math.max(30, live.ticket.expiresInSeconds * 0.8) * 1000;
      shared.timer = setInterval(async () => {
        try {
          const next = await get<RealtimeTicket>("/chat/realtime-token");
          live.client.realtime.setAuth(next.token);
        } catch {
          // Leave the existing token in place. It is still valid for the
          // remaining twenty percent, and the next tick may well succeed.
        }
      }, renewAt);

      return live;
    });
  }

  const live = await shared.promise;
  if (!live) release();
  return live;
}

function release() {
  shared.refs -= 1;
  if (shared.refs > 0) return;

  const pending = shared.promise;
  if (shared.timer) clearInterval(shared.timer);
  shared = { promise: null, timer: null, refs: 0 };
  // Resolved after the last reader left: drop the socket rather than leave it
  // open on a thread nobody is looking at.
  void pending?.then((live) => live?.client.removeAllChannels());
}

export async function subscribeToThread(
  conversationId: string,
  handlers: LiveHandlers,
): Promise<(() => void) | null> {
  const live = await acquire();
  if (!live) return null;

  const { client, ticket } = live;

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
    /*
     * The status callback is the fallback's trigger. CHANNEL_ERROR is what a
     * refused token or a missing RLS policy looks like from here, TIMED_OUT and
     * CLOSED are a dropped connection, and every one of them is silent
     * otherwise — the socket simply stops delivering.
     */
    .subscribe((status) => handlers.onHealth?.(status === "SUBSCRIBED"));

  return () => {
    client.removeChannel(channel);
    release();
  };
}
