"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Ellipsis,
  History,
  Lock,
  Mic,
  Pencil,
  Plus,
  SendHorizontal,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";

import { FileChip, FilePreview, saveFile } from "@/components/portal/file-preview";
import { Hint } from "@/components/portal/hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  assistantApi,
  historyGroups,
  historyWhen,
  type AssistantDocument,
  type AssistantMessage,
  type Conversation,
} from "@/lib/assistant";
import { documentPath } from "@/lib/portal";
import { assistantQuestionSchema, chatTitleSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * Ask AI: the customer's document finder (feature 6), a chat window opened from
 * the top bar (Siddharth, Nov 25 mockup). The customer types or speaks a
 * description of a file; the reply names the matching documents, each one
 * opening and downloading as it does on the Documents list.
 *
 * Chats are kept per person and per company by the server (backend list #10),
 * listed under the history icon with Rename and Delete. The window lives in
 * the shell, so closing it or moving between pages keeps the open chat; the
 * shell keys it by company, so switching company starts clean.
 */

/** What the "Searching" bubble walks through while the one request is out. */
const STEPS = (company: string) => [
  "Understanding what you need",
  `Looking through ${company}'s files`,
  "Picking the best matches",
];

/**
 * The steps are paced, not reported: the server answers in one response.
 * ponytail: timed steps; stream real progress if the backend ever sends it.
 */
const STEP_MS = 700;

const EXAMPLES = [
  "2023 tax return documents",
  "Payroll files uploaded last month",
  "Bank statements from March",
];

/* ------------------------------------------------------------- speech -- */

/**
 * The slice of the Web Speech API used here. TypeScript's DOM types carry its
 * result list but not the recognizer itself, which is not a standard yet.
 */
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  }
}

/** Chrome, Edge and Safari have it (Chrome's under its old prefix); Firefox does not. */
function recognizer(): (new () => Recognition) | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const subscribeNever = () => () => {};

/** Whether to draw the microphone: false on the server and in Firefox. */
function useCanListen(): boolean {
  return React.useSyncExternalStore(
    subscribeNever,
    () => recognizer() !== null,
    () => false,
  );
}

/* ------------------------------------------------------------ the window -- */

export function AskAi({ workspace }: { workspace: { id: string; name: string } }) {
  const companyId = workspace.id;
  const company = workspace.name;

  const [view, setView] = React.useState<"chat" | "history">("chat");
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState(0);
  /** The question that failed, kept so Try Again can send it as it was. */
  const [failed, setFailed] = React.useState<string | null>(null);
  const [chatState, setChatState] = React.useState<"ready" | "loading" | "error">("ready");
  const [draft, setDraft] = React.useState("");
  const [draftError, setDraftError] = React.useState<string | null>(null);
  /** What the microphone has heard so far; null while it is off. */
  const [heard, setHeard] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<Conversation[] | null>(null);
  const [listState, setListState] = React.useState<"idle" | "loading" | "error">("idle");

  // Read inside async handlers, where state would be the value from the click.
  const conversationRef = React.useRef<string | null>(null);
  /** Bumped by New Chat and by opening a chat: a reply for an older one is dropped. */
  const generation = React.useRef(0);
  const busyRef = React.useRef(false);
  const timers = React.useRef<number[]>([]);
  const stopListening = React.useRef<(() => void) | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  const canListen = useCanListen();

  // Keep the newest message in view: scrolling is the DOM, not state.
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, step, failed]);

  // Timers and the microphone are released with the window's owner.
  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      stopListening.current?.();
    },
    [],
  );

  async function loadList() {
    setListState("loading");
    try {
      setConversations(await assistantApi.list(companyId));
      setListState("idle");
    } catch {
      setListState("error");
    }
  }

  function setCurrent(id: string | null) {
    conversationRef.current = id;
    setConversationId(id);
  }

  async function ask(raw: string) {
    const parsed = assistantQuestionSchema.safeParse(raw);
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0].message);
      inputRef.current?.focus();
      return;
    }
    if (busyRef.current) return;
    const text = parsed.data;
    const asked = generation.current;

    busyRef.current = true;
    setBusy(true);
    setFailed(null);
    setDraft("");
    setDraftError(null);
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, role: "user", text, documents: [], searched: null },
    ]);
    setStep(0);
    timers.current = [1, 2].map((n) =>
      window.setTimeout(() => setStep(n), STEP_MS * n),
    );

    try {
      const { conversation, reply } = await assistantApi.send(
        companyId,
        text,
        conversationRef.current,
      );
      setConversations((list) =>
        list ? [conversation, ...list.filter((c) => c.id !== conversation.id)] : list,
      );
      if (generation.current !== asked) return;
      setCurrent(conversation.id);
      setMessages((m) => [...m, reply]);
    } catch {
      if (generation.current === asked) setFailed(text);
    } finally {
      timers.current.forEach(clearTimeout);
      busyRef.current = false;
      setBusy(false);
    }
  }

  function retry() {
    if (!failed) return;
    // The failed question is still on screen; the retry puts it back itself.
    setMessages((m) => m.slice(0, -1));
    void ask(failed);
  }

  /** Point the window at another chat, or none, without changing the view. */
  function reset(next: string | null) {
    generation.current += 1;
    setCurrent(next);
    setMessages([]);
    setFailed(null);
    setDraftError(null);
  }

  function newChat() {
    reset(null);
    setView("chat");
    setChatState("ready");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function openChat(c: Conversation) {
    reset(c.id);
    setView("chat");
    const mine = generation.current;
    setChatState("loading");
    try {
      const read = await assistantApi.read(companyId, c.id);
      if (generation.current !== mine) return;
      setMessages(read);
      setChatState("ready");
    } catch {
      if (generation.current === mine) setChatState("error");
    }
  }

  function listen() {
    const Recognition = recognizer();
    if (!Recognition || busyRef.current) return;
    const r = new Recognition();
    r.lang = "en-US";
    r.interimResults = true;
    let text = "";
    let canceled = false;

    r.onresult = (event) => {
      text = Array.from(event.results, (result) => result[0].transcript).join("");
      setHeard(text);
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setDraftError("Microphone access is blocked. Allow it in your browser settings, or type instead.");
      }
    };
    r.onend = () => {
      stopListening.current = null;
      setHeard(null);
      if (!canceled && text.trim()) void ask(text);
      else requestAnimationFrame(() => inputRef.current?.focus());
    };

    stopListening.current = () => {
      canceled = true;
      r.abort();
    };
    setDraftError(null);
    setHeard("");
    try {
      r.start();
    } catch {
      // Already listening, or the browser refused outright: back to typing.
      stopListening.current = null;
      setHeard(null);
    }
  }

  const empty = messages.length === 0 && chatState === "ready" && !busy;
  const recent = conversations?.slice(0, 3) ?? [];

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open && conversations === null && listState !== "loading") void loadList();
        if (!open) stopListening.current?.();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-full border-primary/30 bg-accent text-accent-foreground hover:bg-accent/70 hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground"
        >
          <Sparkles className="text-primary" aria-hidden />
          Ask AI
        </Button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="top-auto right-6 bottom-6 left-auto flex h-[min(40rem,calc(100dvh-3rem))] w-[25rem] max-w-[calc(100%-2rem)] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[25rem]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        // A rename or a delete question takes Escape for itself: see ChatHistory.
        onEscapeKeyDown={(event) => {
          if (event.target instanceof Element && event.target.closest("[data-holds-escape]")) {
            event.preventDefault();
          }
        }}
      >
        <header className="flex items-center gap-3 border-b border-border bg-accent/40 py-3 pr-2 pl-4">
          <BotMark className="size-9 rounded-xl" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-1.5 text-base font-semibold">
              Document Assistant
              <Badge className="h-4 rounded px-1.5 text-[10px] font-bold">AI</Badge>
            </DialogTitle>
            <DialogDescription className="truncate text-xs text-muted-foreground">
              Finds files in {company}
            </DialogDescription>
          </div>
          <Hint label="Chat history">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={view === "history"}
              onClick={() => {
                if (view === "history") return setView("chat");
                setView("history");
                if (listState !== "loading") void loadList();
              }}
            >
              <History aria-hidden />
              <span className="sr-only">Chat history</span>
            </Button>
          </Hint>
          <Hint label="New chat">
            <Button variant="ghost" size="icon-sm" disabled={busy} onClick={newChat}>
              <SquarePen aria-hidden />
              <span className="sr-only">New chat</span>
            </Button>
          </Hint>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm">
              <X aria-hidden />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </header>

        {view === "history" ? (
          <ChatHistory
            companyId={companyId}
            conversations={conversations}
            listState={listState}
            current={conversationId}
            busy={busy}
            onRetry={loadList}
            onBack={() => setView("chat")}
            onNew={newChat}
            onOpen={openChat}
            onChange={setConversations}
            onDeletedCurrent={() => reset(null)}
          />
        ) : (
          <>
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/60 p-4"
            >
              {empty ? (
                <Welcome
                  company={company}
                  recent={recent}
                  onOpen={openChat}
                  onAsk={(q) => void ask(q)}
                />
              ) : null}

              {chatState === "loading" ? (
                <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Spinner aria-hidden />
                  Loading this chat…
                </p>
              ) : null}

              {chatState === "error" ? (
                <div role="alert" className="py-10 text-center text-sm">
                  <p className="text-muted-foreground">This chat couldn&apos;t be loaded.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      const c = conversations?.find((x) => x.id === conversationId);
                      if (c) void openChat(c);
                      else newChat();
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              ) : null}

              {messages.map((m) =>
                m.role === "user" ? (
                  <p
                    key={m.id}
                    className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap break-words text-primary-foreground"
                  >
                    {m.text}
                  </p>
                ) : (
                  <Reply key={m.id} message={m} />
                ),
              )}

              {busy ? <Finding company={company} step={step} /> : null}

              {failed ? (
                <div role="alert" className="flex items-start gap-2">
                  <BotMark className="mt-0.5 size-6 rounded-lg" />
                  <div className="rounded-2xl rounded-bl-sm border border-destructive/30 bg-card px-3 py-2 text-sm">
                    <p>I couldn&apos;t search just now. Check your connection and try again.</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              className="shrink-0 border-t border-border bg-card p-3"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void ask(draft);
              }}
            >
              {heard !== null ? (
                <div
                  role="status"
                  className="flex h-12 items-center gap-3 rounded-lg border border-primary/40 bg-accent/50 pr-1 pl-3"
                >
                  <span aria-hidden className="flex h-5 items-center gap-0.5">
                    {[2, 4, 3, 5, 2].map((h, i) => (
                      <span
                        // A fixed decoration: the bars never reorder.
                        key={i}
                        className="w-0.5 rounded-full bg-primary motion-safe:animate-pulse"
                        style={{ height: `${h * 4}px`, animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-accent-foreground">
                    {heard || "Listening…"}
                  </span>
                  <Hint label="Stop listening">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => stopListening.current?.()}
                    >
                      <Square className="fill-current" aria-hidden />
                      <span className="sr-only">Stop listening</span>
                    </Button>
                  </Hint>
                </div>
              ) : (
                <div className="flex items-center gap-1 rounded-lg border border-input bg-card pr-1 pl-1 transition-[border-color] duration-150 focus-within:border-primary focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    ref={inputRef}
                    value={draft}
                    maxLength={500}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (draftError) setDraftError(null);
                    }}
                    placeholder="Describe the file you need"
                    aria-label="Describe the document"
                    aria-invalid={draftError ? true : undefined}
                    aria-describedby={draftError ? "ask-ai-error" : undefined}
                    autoComplete="off"
                    className="h-10 border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                  {canListen ? (
                    <Hint label="Speak instead">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={listen}
                      >
                        <Mic aria-hidden />
                        <span className="sr-only">Speak instead</span>
                      </Button>
                    </Hint>
                  ) : null}
                  <Hint label="Send">
                    <Button type="submit" size="icon-sm" disabled={!draft.trim() || busy}>
                      <SendHorizontal aria-hidden />
                      <span className="sr-only">Send</span>
                    </Button>
                  </Hint>
                </div>
              )}

              {draftError ? (
                <p id="ask-ai-error" role="alert" className="mt-2 text-sm text-destructive">
                  {draftError}
                </p>
              ) : null}

              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                AI reads file names and details only, never what&apos;s inside.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- parts -- */

function BotMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary text-primary-foreground",
        className,
      )}
    >
      <Sparkles className="size-1/2" />
    </span>
  );
}

function Welcome({
  company,
  recent,
  onOpen,
  onAsk,
}: {
  company: string;
  recent: Conversation[];
  onOpen: (c: Conversation) => void;
  onAsk: (question: string) => void;
}) {
  const row =
    "flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30";

  return (
    <div className="grid gap-4">
      <div className="pt-4 text-center">
        <BotMark className="mx-auto mb-3 size-12 rounded-2xl" />
        <h3 className="text-base font-semibold">Find a Document in Seconds</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe the file you&apos;re looking for and I&apos;ll search every document in {company}.
        </p>
      </div>

      {recent.length ? (
        <section aria-labelledby="ask-ai-recent" className="grid gap-2">
          <h4 id="ask-ai-recent" className="text-xs text-muted-foreground">
            Recent Chats
          </h4>
          {recent.map((c) => (
            <button key={c.id} type="button" className={cn(row, "border-dashed")} onClick={() => onOpen(c)}>
              <History className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="ask-ai-examples" className="grid gap-2">
        <h4 id="ask-ai-examples" className="text-xs text-muted-foreground">
          Try Asking
        </h4>
        {EXAMPLES.map((q) => (
          <button key={q} type="button" className={row} onClick={() => onAsk(q)}>
            {q}
          </button>
        ))}
      </section>
    </div>
  );
}

function Finding({ company, step }: { company: string; step: number }) {
  return (
    <div className="flex items-start gap-2">
      <BotMark className="mt-0.5 size-6 rounded-lg" />
      <div className="min-w-60 rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2.5">
        <p className="text-sm font-semibold text-primary motion-safe:animate-pulse">
          Searching {company}&apos;s documents…
        </p>
        <ol aria-hidden className="mt-2 grid gap-2">
          {STEPS(company).map((label, i) => (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2 text-sm",
                i < step ? "text-muted-foreground" : i === step ? "text-foreground" : "text-muted-foreground/60",
              )}
            >
              {i < step ? (
                <Check className="size-3.5 text-success" />
              ) : i === step ? (
                <Spinner className="size-3.5 text-primary" />
              ) : (
                <span className="size-3.5 rounded-full border border-border" />
              )}
              {label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Reply({ message }: { message: AssistantMessage }) {
  return (
    <div className="flex items-start gap-2">
      <BotMark className="mt-0.5 size-6 rounded-lg" />
      <div className="grid min-w-0 flex-1 gap-2">
        {message.searched !== null ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3.5 text-success" aria-hidden />
            Searched {message.searched} {message.searched === 1 ? "file" : "files"}
          </p>
        ) : null}
        <p className="max-w-[95%] justify-self-start rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm whitespace-pre-wrap break-words">
          {message.text}
        </p>
        {message.documents.length ? (
          <ul aria-label="Matching documents" className="grid gap-2">
            {message.documents.map((d) => (
              <DocumentCard key={d.id} doc={d} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function DocumentCard({ doc }: { doc: AssistantDocument }) {
  const href = documentPath(doc);
  const meta = [doc.service, doc.project, doc.owner, doc.uploadedAt].filter(Boolean).join(" · ");

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
      <FileChip name={doc.name} />
      <span className="min-w-0 flex-1">
        <FilePreview name={doc.name} href={href} size={doc.size} className="block max-w-full text-sm font-medium" />
        <span className="block truncate text-xs text-muted-foreground" title={meta}>
          {meta}
        </span>
      </span>
      {href ? (
        <Hint label="Download">
          <Button variant="ghost" size="icon-sm" onClick={() => saveFile(doc.name, href)}>
            <Download aria-hidden />
            <span className="sr-only">Download {doc.name}</span>
          </Button>
        </Hint>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------- history -- */

function ChatHistory({
  companyId,
  conversations,
  listState,
  current,
  busy,
  onRetry,
  onBack,
  onNew,
  onOpen,
  onChange,
  onDeletedCurrent,
}: {
  companyId: string;
  conversations: Conversation[] | null;
  listState: "idle" | "loading" | "error";
  current: string | null;
  busy: boolean;
  onRetry: () => void;
  onBack: () => void;
  onNew: () => void;
  onOpen: (c: Conversation) => void;
  onChange: React.Dispatch<React.SetStateAction<Conversation[] | null>>;
  onDeletedCurrent: () => void;
}) {
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [titleError, setTitleError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState(false);
  /** Set by a menu choice, so the menu does not pull focus back off the field it opened. */
  const chose = React.useRef(false);
  /** Escape leaves the field without saving; its blur must not save either. */
  const canceled = React.useRef(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const focusRow = (id: string) =>
    requestAnimationFrame(() => document.getElementById(`ask-ai-chat-${id}`)?.focus());

  async function saveTitle(c: Conversation) {
    if (canceled.current) {
      canceled.current = false;
      return;
    }
    const parsed = chatTitleSchema.safeParse(title);
    if (!parsed.success) {
      setTitleError(parsed.error.issues[0].message);
      return;
    }
    setRenaming(null);
    setTitleError(null);
    focusRow(c.id);
    if (parsed.data === c.title) return;
    const rename = (to: string) =>
      onChange((list) => list?.map((x) => (x.id === c.id ? { ...x, title: to } : x)) ?? list);
    rename(parsed.data);
    try {
      await assistantApi.rename(companyId, c.id, parsed.data);
    } catch {
      rename(c.title);
      toast.error("This chat couldn't be renamed. Try again.");
    }
  }

  async function remove(c: Conversation) {
    setRemoving(true);
    try {
      await assistantApi.remove(companyId, c.id);
      onChange((list) => list?.filter((x) => x.id !== c.id) ?? list);
      setDeleting(null);
      if (c.id === current) onDeletedCurrent();
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      toast.error("This chat couldn't be deleted. Try again.");
    } finally {
      setRemoving(false);
    }
  }

  const groups = conversations ? historyGroups(conversations) : [];

  return (
    <section
      aria-labelledby="ask-ai-history"
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => {
        // Inside a rename or a delete question, Escape backs out of that
        // rather than closing the window (`data-holds-escape`).
        if (event.key !== "Escape" || (!renaming && !deleting)) return;
        if (renaming) {
          canceled.current = true;
          const id = renaming;
          setRenaming(null);
          setTitleError(null);
          focusRow(id);
        } else if (deleting) {
          const id = deleting;
          setDeleting(null);
          focusRow(id);
        }
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-border py-2 pr-3 pl-2">
        <Hint label="Back to chat">
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft aria-hidden />
            <span className="sr-only">Back to chat</span>
          </Button>
        </Hint>
        <h3 id="ask-ai-history" ref={headingRef} tabIndex={-1} className="flex-1 text-sm font-semibold outline-none">
          Chat History
        </h3>
        <Button variant="outline" size="sm" disabled={busy} onClick={onNew}>
          <Plus aria-hidden />
          New Chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {listState === "loading" && conversations === null ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner aria-hidden />
            Loading your chats…
          </p>
        ) : listState === "error" ? (
          <div role="alert" className="py-10 text-center text-sm">
            <p className="text-muted-foreground">Your chats couldn&apos;t be loaded.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              Try Again
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No chats yet. Your conversations will show up here.
          </p>
        ) : (
          groups.map(({ group, conversations: rows }) => (
            <section key={group} aria-label={group}>
              <h4 className="px-2 pt-3 pb-1 text-xs text-muted-foreground">{group}</h4>
              <ul className="grid gap-0.5">
                {rows.map((c) =>
                  deleting === c.id ? (
                    <li
                      key={c.id}
                      role="alertdialog"
                      data-holds-escape
                      aria-labelledby={`ask-ai-delete-${c.id}`}
                      className="my-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                    >
                      <p id={`ask-ai-delete-${c.id}`}>
                        Delete <b className="font-semibold break-words">{c.title}</b>? This
                        can&apos;t be undone. Your documents stay where they are.
                      </p>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          autoFocus
                          disabled={removing}
                          onClick={() => {
                            setDeleting(null);
                            focusRow(c.id);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="bg-destructive text-white hover:bg-destructive/85"
                          disabled={removing}
                          onClick={() => void remove(c)}
                        >
                          {removing ? <Spinner aria-hidden /> : <Trash2 aria-hidden />}
                          Delete Chat
                        </Button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={c.id}
                      className={cn(
                        "flex items-center gap-1 rounded-lg py-1 pr-1 pl-2",
                        c.id === current ? "bg-accent" : "hover:bg-muted",
                      )}
                    >
                      {renaming === c.id ? (
                        <div data-holds-escape className="min-w-0 flex-1 py-0.5">
                          <Input
                            autoFocus
                            value={title}
                            maxLength={80}
                            aria-label="Chat name"
                            aria-invalid={titleError ? true : undefined}
                            aria-describedby={titleError ? `ask-ai-title-${c.id}` : undefined}
                            onChange={(event) => setTitle(event.target.value)}
                            onFocus={(event) => event.currentTarget.select()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                            }}
                            onBlur={() => void saveTitle(c)}
                            className="h-8"
                          />
                          {titleError ? (
                            <p id={`ask-ai-title-${c.id}`} role="alert" className="mt-1 text-xs text-destructive">
                              {titleError}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          id={`ask-ai-chat-${c.id}`}
                          type="button"
                          aria-current={c.id === current ? "true" : undefined}
                          disabled={busy}
                          onClick={() => onOpen(c)}
                          className="min-w-0 flex-1 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60"
                        >
                          <span className="block truncate text-sm font-medium" title={c.title}>
                            {c.title}
                          </span>
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {historyWhen(c.updatedAt)}
                          </span>
                        </button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" disabled={renaming === c.id}>
                            <Ellipsis aria-hidden />
                            <span className="sr-only">More options for {c.title}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-36"
                          onCloseAutoFocus={(event) => {
                            if (chose.current) event.preventDefault();
                            chose.current = false;
                          }}
                        >
                          <DropdownMenuItem
                            onSelect={() => {
                              chose.current = true;
                              setDeleting(null);
                              setTitle(c.title);
                              setTitleError(null);
                              setRenaming(c.id);
                            }}
                          >
                            <Pencil aria-hidden />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              chose.current = true;
                              setRenaming(null);
                              setDeleting(c.id);
                            }}
                          >
                            <Trash2 aria-hidden />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
