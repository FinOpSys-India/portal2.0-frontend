"use client";

import * as React from "react";
import { Paperclip, SendHorizontal, Trash2 } from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { chatApi } from "@/lib/chat";
import { subscribeToThread } from "@/lib/chat-realtime";
import {
  dayLabel,
  formatFileSize,
  MAX_UPLOAD_BYTES,
  messageTime,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/manager";
import { cn } from "@/lib/utils";

/**
 * One chat thread: who you are talking to, the messages, the composer.
 *
 * Loading and sending arrive as functions rather than an api object, because
 * the two portals that use this reach different endpoints — the manager's
 * messages hang off a conversation id, the specialist has exactly one thread
 * and no id to pass.
 */
export function ChatThread({
  contact,
  badge,
  meta,
  load,
  send,
  sendFile,
  conversationId,
  onRead,
}: {
  /** The counterparty. Drives the avatar and the composer's label. */
  contact: string;
  /** Optional chip beside the name, e.g. their role. */
  badge?: React.ReactNode;
  /** Optional right-aligned detail, e.g. the company. */
  meta?: React.ReactNode;
  load: () => Promise<ChatMessage[]>;
  send: (body: string) => Promise<ChatMessage>;
  /** Enables the attach button. Omit where the thread takes text only. */
  sendFile?: (file: File) => Promise<ChatMessage>;
  /**
   * The thread being read. Supplied by every caller that has one, so opening it
   * can clear the badge — without it the unread count survived being read.
   */
  conversationId?: string | null;
  /** Told the new unread total after a read receipt, so a badge can follow. */
  onRead?: (unread: number) => void;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  /**
   * Put a message into the thread exactly once.
   *
   * Every path that adds one goes through here — the send, the attach, and the
   * socket — because the same message legitimately arrives twice: once as the
   * POST's response and once as the row the socket echoes back to its own
   * author. Keyed by id, whichever lands second replaces the first rather than
   * appearing beside it, and the race between them stops mattering.
   */
  const merge = React.useCallback((incoming: ChatMessage) => {
    setMessages((rows) => {
      const next = [
        ...(rows ?? []).filter((m) => m.id !== incoming.id),
        incoming,
      ];
      // The server's clock, not arrival order: a live row can land while an
      // older page is still being read.
      return next.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    });
  }, []);

  // `load` is a fresh closure on every render, so the effect keys off the
  // contact instead — remounting on a thread switch is the caller's job, and
  // both callers pass `key`.
  React.useEffect(() => {
    let live = true;
    load().then((rows) => {
      if (live) setMessages(rows);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact]);

  /*
   * Opening a thread is what marks it read — nothing did, so a badge counted
   * messages the user had already looked at until the next message arrived.
   *
   * Separate from the load effect and deliberately not awaited by it: a failed
   * receipt must leave the messages on screen. The worst case is a stale badge,
   * which is what the code did every time before.
   */
  React.useEffect(() => {
    if (!conversationId) return;
    let live = true;
    chatApi
      .markRead(conversationId)
      .then((unread) => {
        if (live) onRead?.(unread);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  /*
   * LIVE UPDATES.
   *
   * `merge` rather than a plain append, and that is the whole fix for the
   * duplicate: sending already puts the returned message into state, and the
   * socket then delivers that same row back to its own author. Keyed by id,
   * the second arrival replaces the first instead of appearing beside it.
   *
   * Ordering is by `sentAt` because a live row can land while an older page is
   * still being read, and the server's clock is the only one worth trusting.
   *
   * A NULL SUBSCRIPTION IS NOT NOTHING TO DO. The socket needs a Supabase
   * publishable key in this bundle and a project secret on the backend, and a
   * deployment missing either got no live updates and no fallback — the other
   * portal's reply sat on the server until somebody reloaded, which is not a
   * conversation. Polling covers that case, and only that case: with a real
   * channel open the interval never starts.
   */
  React.useEffect(() => {
    if (!conversationId) return;

    let live = true;
    let teardown = () => {};

    const reload = () =>
      load().then((rows) => {
        if (live) setMessages(rows);
      });

    subscribeToThread(conversationId, {
      onMessage: merge,
      // The payload could not describe the message — an attachment-only row.
      // Re-read the thread rather than render an empty bubble.
      onReload: reload,
      onDelete: (id) =>
        setMessages((rows) => (rows ?? []).filter((m) => m.id !== id)),
    }).then((stop) => {
      // Resolved after an unmount that already ran: stop it immediately rather
      // than leaving a socket open on a thread nobody is looking at.
      if (!live) {
        stop?.();
        return;
      }
      if (stop) {
        teardown = stop;
        return;
      }
      // ponytail: a fixed 8s re-read of the open thread, and only while it is
      // open. Configure the Supabase keys and this never runs.
      const timer = setInterval(reload, 8_000);
      teardown = () => clearInterval(timer);
    });

    return () => {
      live = false;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, merge]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [messages]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setFailure(null);
    try {
      merge(await send(body));
      setDraft("");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  /**
   * Removed from the list before the request returns, and put back if it
   * fails. A delete that leaves the bubble on screen until a round trip
   * finishes reads as a broken button and gets clicked twice.
   */
  async function remove(message: ChatMessage) {
    const previous = messages;
    setMessages((rows) => (rows ?? []).filter((m) => m.id !== message.id));
    try {
      await chatApi.deleteMessage(message.id);
    } catch (err) {
      setMessages(previous);
      setFailure(err instanceof Error ? err.message : "Could not delete that.");
    }
  }

  async function attach(file: File) {
    if (!sendFile || sending) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setFailure(`That file is ${formatFileSize(file.size)}. The limit is 500 MB.`);
      return;
    }

    setSending(true);
    setFailure(null);
    try {
      merge(await sendFile(file));
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not send that file.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <InitialsAvatar name={contact} />
        <span className="font-semibold">{contact}</span>
        {badge}
        {meta ? (
          <span className="ml-auto truncate text-sm text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
        {messages === null ? (
          <Spinner className="mx-auto mt-4" />
        ) : (
          messages.map((message, index) => (
            <React.Fragment key={message.id}>
              {/* A divider only where the day turns over, so a thread sent in
                  one sitting is not sliced up by repeated headers. */}
              {isNewDay(message, messages[index - 1]) ? (
                <DayDivider label={dayLabel(message.sentAt)} />
              ) : null}
              <Bubble message={message} onDelete={remove} />
            </React.Fragment>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-border p-3">
        {/* One control, not three sitting next to each other: the border and
            the focus ring live on the group, so tabbing to the attach button
            or the field lights the whole composer. */}
        <div className="flex items-center gap-1 rounded-lg border border-input bg-card pr-1 pl-1 transition-[border-color] duration-150 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring">
          {sendFile ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={sending}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip aria-hidden />
                <span className="sr-only">Attach a file</span>
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  // Cleared first: picking the same file twice in a row fires
                  // no change event otherwise, and the second send is lost.
                  event.target.value = "";
                  if (picked) attach(picked);
                }}
              />
            </>
          ) : null}

          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type here..."
            aria-label={`Message ${contact}`}
            className="h-10 border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0"
          />

          <Button
            type="submit"
            size="icon-sm"
            disabled={!draft.trim() || sending}
          >
            <SendHorizontal aria-hidden />
            <span className="sr-only">Send</span>
          </Button>
        </div>

        {failure ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/** True when this message starts a different calendar day than the one before. */
function isNewDay(message: ChatMessage, previous: ChatMessage | undefined) {
  if (!previous) return true;
  return (
    new Date(message.sentAt).toDateString() !==
    new Date(previous.sentAt).toDateString()
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * One message. `w-fit` is the whole trick: a block bubble would stretch to the
 * full column and a two-word reply would look like a paragraph.
 *
 * A message can carry BOTH text and files, so the two are stacked rather than
 * chosen between — the old version rendered the attachment INSTEAD of the body,
 * which silently dropped whatever had been typed alongside it.
 */
function Bubble({
  message,
  onDelete,
}: {
  message: ChatMessage;
  onDelete: (message: ChatMessage) => void;
}) {
  const files = message.attachments;

  return (
    <div className={cn("group flex items-end gap-1", message.mine && "flex-row-reverse")}>
      <div
        className={cn(
          "flex w-fit max-w-[70%] flex-col gap-1 rounded-xl px-3 py-1.5",
          message.mine ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {files.map((file) => (
          <AttachmentLink key={file.id} file={file} mine={message.mine} />
        ))}

        <div className="flex items-end gap-2">
          {/* An attachment-only message has no body. Rendering an empty
              paragraph would add a blank line under the file. */}
          {message.body ? (
            <p className="text-sm break-words">{message.body}</p>
          ) : null}
          <span
            className={cn(
              "ml-auto shrink-0 text-[11px] leading-5 tabular-nums",
              message.mine
                ? "text-primary-foreground/70"
                : "text-muted-foreground",
            )}
          >
            {messageTime(message.sentAt)}
          </span>
        </div>
      </div>

      {/* Only your own. The server refuses anything else outright; this just
          declines to offer a control that would always fail. */}
      {message.mine ? (
        <button
          type="button"
          onClick={() => onDelete(message)}
          aria-label="Delete this message"
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * An attachment, downloaded on click.
 *
 * A button rather than an anchor, because there is no URL to put in an `href`
 * until one is asked for: the bytes are in a private bucket and the link is
 * signed for about a minute. One minted when the thread rendered would be dead
 * before a reader scrolled to it.
 */
function AttachmentLink({
  file,
  mine,
}: {
  file: ChatAttachment;
  mine: boolean;
}) {
  const [opening, setOpening] = React.useState(false);

  async function open() {
    if (opening) return;
    setOpening(true);
    try {
      const url = await chatApi.downloadUrl(file.id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={opening}
      className="flex min-w-0 items-center gap-2 rounded-md text-left text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60"
    >
      {opening ? (
        <Spinner className="size-4 shrink-0" />
      ) : (
        <Paperclip className="size-4 shrink-0" aria-hidden />
      )}
      <span className="truncate font-medium">{file.name}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          mine ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {formatFileSize(file.size)}
      </span>
    </button>
  );
}
