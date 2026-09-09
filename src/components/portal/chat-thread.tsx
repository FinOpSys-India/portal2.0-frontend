"use client";

import * as React from "react";
import { Paperclip, SendHorizontal, Smile, SmilePlus, Trash2 } from "lucide-react";

import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { COMPOSER_EMOJI, REACTIONS, toggleLocal } from "@/lib/reactions";
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
      // Marked, not removed: the other side's bubble becomes "This message was
      // deleted" in place. Dropping the row instead would erase the fact that
      // anything was ever said, and shift every bubble under it.
      onDelete: (id) =>
        setMessages((rows) =>
          (rows ?? []).map((m) =>
            m.id === id
              ? { ...m, deleted: true, body: "", attachments: [], reactions: [] }
              : m,
          ),
        ),
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
   * Turned into a tombstone before the request returns, and put back if it
   * fails. A delete that leaves the bubble intact until a round trip finishes
   * reads as a broken button and gets clicked twice.
   *
   * THE ROW STAYS. The backend's delete is soft — `chat_messages.deleted_at` —
   * and what the sender sees here is what the other side gets over the socket:
   * the bubble in place, saying it was deleted. Filtering it out instead left
   * the two screens disagreeing about whether a message had ever existed.
   *
   * `body`, `attachments` and `reactions` are cleared along with the flag, so
   * nothing that was in the message survives in this tab's memory. The bytes of
   * an attachment are a separate question the server answers: chatService
   * refuses to sign a download for a deleted message's file.
   */
  async function remove(message: ChatMessage) {
    const previous = messages;
    setMessages((rows) =>
      (rows ?? []).map((m) =>
        m.id === message.id
          ? { ...m, deleted: true, body: "", attachments: [], reactions: [] }
          : m,
      ),
    );
    try {
      await chatApi.deleteMessage(message.id);
    } catch (err) {
      setMessages(previous);
      setFailure(err instanceof Error ? err.message : "Could not delete that.");
    }
  }

  /**
   * Add or drop the viewer's reaction.
   *
   * OPTIMISTIC, and it has to be: the chip moves on the click rather than on
   * the round trip, because a reaction that waits reads as a dead button and
   * gets pressed twice — which, on a toggle, undoes itself.
   *
   * The server's list replaces the guess on the way back rather than being
   * discarded as "the same thing". Somebody else's reaction can land while this
   * request is in flight, and only the answer carries that.
   *
   * Written straight into `setMessages` rather than through `merge`: this
   * changes one field of a message already on screen, where `merge` replaces a
   * whole row and would drop the attachments a live payload never carries.
   */
  async function react(message: ChatMessage, emoji: string) {
    const previous = message.reactions;
    const patch = (reactions: ChatMessage["reactions"]) =>
      setMessages((rows) =>
        (rows ?? []).map((m) => (m.id === message.id ? { ...m, reactions } : m)),
      );

    patch(toggleLocal(previous, emoji));
    try {
      patch(await chatApi.react(message.id, emoji));
    } catch (err) {
      patch(previous);
      setFailure(err instanceof Error ? err.message : "Could not react.");
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
              <Bubble message={message} onDelete={remove} onReact={react} />
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

          {/* Beside the paperclip rather than inside the field: both add
              something to the message that typing cannot, and a control that
              overlays the text would cover what is being written. */}
          <EmojiPicker
            disabled={sending}
            onPick={(emoji) => setDraft((text) => text + emoji)}
          />

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
  onReact,
}: {
  message: ChatMessage;
  onDelete: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
}) {
  const files = message.attachments;

  /*
   * A deleted message keeps its place, its side and its time, and loses
   * everything else — no text, no files, no chips, and neither action, since
   * there is nothing left to react to or delete twice. The outline instead of
   * a filled bubble is what makes it legible at a glance as an absence rather
   * than as something somebody actually sent.
   */
  if (message.deleted) {
    return (
      <div className={cn("flex", message.mine && "flex-row-reverse")}>
        <div className="flex w-fit max-w-[70%] items-end gap-2 rounded-xl border border-dashed border-border px-3 py-1.5 text-muted-foreground">
          <p className="text-sm italic">This message was deleted</p>
          <span className="ml-auto shrink-0 text-[11px] leading-5 tabular-nums">
            {messageTime(message.sentAt)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group flex items-end gap-1", message.mine && "flex-row-reverse")}>
      {/* The column exists for the chips: they hang UNDER the bubble rather
          than inside it, so a reaction never reflows the text it is about, and
          `max-w` moved up here so the chip row is bounded the same way. */}
      <div
        className={cn(
          "flex max-w-[70%] flex-col gap-1",
          message.mine && "items-end",
        )}
      >
        <div
          className={cn(
            "flex w-fit flex-col gap-1 rounded-xl px-3 py-1.5",
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

        {message.reactions.length ? (
          <div className="flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onReact(message, reaction.emoji)}
                /* The name a screen reader reads is the emoji itself, which it
                   announces by its CLDR name ("thumbs up"), plus the count.
                   `aria-pressed` is what says the viewer is one of them —
                   without it the filled and hollow chips sound identical. */
                aria-pressed={reaction.mine}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                  reaction.mine
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="text-sm leading-none">{reaction.emoji}</span>
                {reaction.count}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Beside the bubble and revealed on hover, the way the delete already
          was. `self-end` keeps both pinned to the bubble's last line rather
          than floating beside a chip row that may not be there. */}
      <div className="flex items-center gap-0.5 self-end pb-0.5">
        <ReactionPicker onPick={(emoji) => onReact(message, emoji)} />

        {/* Only your own. The server refuses anything else outright; this just
            declines to offer a control that would always fail. */}
        {message.mine ? (
          <button
            type="button"
            onClick={() => onDelete(message)}
            aria-label="Delete this message"
            className={cn(ACTION_BUTTON, "hover:text-destructive")}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The hover-revealed controls beside a bubble.
 *
 * `data-[state=open]` is not decoration: the reaction popover's trigger is one
 * of these, and without it the button it is anchored to fades out the moment
 * the pointer moves into the popover — leaving a menu floating beside nothing.
 */
const ACTION_BUTTON =
  "rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30";

/**
 * The six reactions, on one message.
 *
 * CONTROLLED, unlike the composer's picker, and the difference is what each is
 * for: reacting is one decision and the popover should get out of the way once
 * it is made, whereas someone decorating a sentence often wants three emoji and
 * should not have to reopen the grid twice.
 */
function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="React to this message" className={ACTION_BUTTON}>
          <SmilePlus className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto flex-row gap-0.5 p-1">
        {REACTIONS.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            aria-label={label}
            onClick={() => {
              onPick(emoji);
              setOpen(false);
            }}
            className="rounded-md p-1 text-lg leading-none transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          >
            <span aria-hidden>{emoji}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The composer's emoji grid.
 *
 * UNCONTROLLED — it stays open after a pick, so a run of emoji costs one click
 * each rather than one click plus one reopen. Dismissal is Escape or a click
 * outside, which Radix already handles and which is what every other popover on
 * this app does.
 */
function EmojiPicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (emoji: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}>
          <Smile aria-hidden />
          <span className="sr-only">Insert an emoji</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        {/* Six wide and scrolling. Ninety-six at six across is sixteen rows,
            which is taller than a popover should be — so the box is capped and
            the list scrolls inside it. The cap is in rem rather than rows so it
            does not need revisiting every time the set changes size. */}
        <div className="grid max-h-64 grid-cols-6 gap-0.5 overflow-y-auto">
          {COMPOSER_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              /* text-2xl is 24px against the 18px of text-lg — the +33% step
                 Tailwind actually has, rather than an arbitrary 23.4px. */
              className="rounded-md p-1 text-2xl leading-none hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
