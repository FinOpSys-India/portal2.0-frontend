"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";

import { EmptyFace, Face, Handover, Settle, Side } from "@/components/portal/handover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { formatFileSize } from "@/lib/manager";
import {
  archiveDocument,
  deleteDocument,
  deleteProject,
  documentPath,
  documentsMessage,
  eachDocument,
} from "@/lib/portal";

/** What the warning needs to describe a file. Every portal's file rows carry it. */
export interface DeletableDoc {
  id: string;
  projectId: string | null;
  name: string;
  /** Absent on the project pages, where every file is that page's project. */
  project?: string | null;
  size: number;
}

/**
 * How long Delete must be held. 1.5–3 s is the range hold-to-confirm patterns
 * use for an irreversible action; longer reads as a broken button, and the
 * warning around it is already the first check.
 */
const HOLD_MS = 2000;

/** Rows named in the warning before the rest collapse to "+N more". */
const LISTED = 5;

const SelectionContext = React.createContext<{
  selected: Map<string, DeletableDoc>;
  toggle: (doc: DeletableDoc) => void;
  drop: (ids: string[]) => void;
} | null>(null);

/**
 * Holds the ticked files for one list.
 *
 * Wraps the server-rendered table rather than living in it: the table is a
 * Server Component, so the checkboxes in its cells and the bar above it meet
 * here. It sits above the pager, so a selection survives turning the page.
 */
export function DocumentSelection({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = React.useState(
    () => new Map<string, DeletableDoc>(),
  );

  const value = React.useMemo(
    () => ({
      selected,
      toggle: (doc: DeletableDoc) =>
        setSelected((prev) => {
          const next = new Map(prev);
          if (!next.delete(doc.id)) next.set(doc.id, doc);
          return next;
        }),
      drop: (ids: string[]) =>
        setSelected((prev) => {
          const next = new Map(prev);
          for (const id of ids) next.delete(id);
          return next;
        }),
    }),
    [selected],
  );

  return (
    <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
  );
}

/**
 * A row’s checkbox. Only the uploader can tick it, because all a
 * selection does is archive or delete — and both are theirs alone (see `DocumentActions`).
 *
 * Renders nothing outside a `DocumentSelection`, so a list that never offers
 * bulk delete can share the same row markup.
 */
export function SelectBox({
  doc,
  viewerId,
}: {
  doc: DeletableDoc & { ownerId: string | null };
  viewerId: string;
}) {
  const selection = React.useContext(SelectionContext);
  if (!selection) return null;

  const mine = doc.ownerId !== null && doc.ownerId === viewerId && !!doc.projectId;

  return (
    <span
      className="inline-flex shrink-0"
      title={mine ? undefined : "Only the uploader can archive or delete this"}
    >
      <input
        type="checkbox"
        className="size-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!mine}
        checked={mine && selection.selected.has(doc.id)}
        onChange={() => selection.toggle(doc)}
        aria-label={
          mine ? `Select ${doc.name}` : `Only the uploader can archive or delete ${doc.name}`
        }
      />
    </span>
  );
}

/** What the warning is confirming. Archive is undone by its year running out, delete by nothing. */
export type DocumentsAction = "delete" | "archive";

/** "N selected · size · Clear · Archive · Delete", shown only while something is ticked. */
export function SelectionBar({
  archived = false,
}: {
  /** On the Archive tab, where the selection is already archived. */
  archived?: boolean;
}) {
  const selection = React.useContext(SelectionContext);
  const [action, setAction] = React.useState<DocumentsAction | null>(null);
  if (!selection || selection.selected.size === 0) return null;

  const docs = [...selection.selected.values()];
  const size = docs.reduce((sum, doc) => sum + doc.size, 0);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1">
      <span className="text-sm tabular-nums">
        {docs.length} selected · {formatFileSize(size)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => selection.drop(docs.map((d) => d.id))}
      >
        Clear
      </Button>
      {archived ? null : (
        <Button variant="outline" size="sm" onClick={() => setAction("archive")}>
          Archive
        </Button>
      )}
      <Button variant="destructive" size="sm" onClick={() => setAction("delete")}>
        Delete
      </Button>
      <DocumentsDialog
        action={action ?? "delete"}
        docs={docs}
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
      />
    </div>
  );
}

/**
 * The warning before a delete or an archive, for one file or many.
 *
 * Delete says the three things a person cannot see from the row: that the file
 * goes for everyone on the company, that nothing brings it back, and that a
 * copy can still be taken now — and is confirmed by holding, not clicking (see
 * `HoldToDelete`). Archive says where the file goes and for how long; it is a
 * plain click, because it takes a year to become permanent.
 */
export function DocumentsDialog({
  action,
  docs,
  open,
  onOpenChange,
}: {
  action: DocumentsAction;
  docs: DeletableDoc[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const selection = React.useContext(SelectionContext);
  const [pending, setPending] = React.useState(false);

  const total = docs.reduce((sum, doc) => sum + doc.size, 0);
  const noun = docs.length === 1 ? "Document" : `${docs.length} Documents`;
  const archiving = action === "archive";

  async function run() {
    setPending(true);
    const { done, failed } = await eachDocument(
      docs,
      archiving ? archiveDocument : deleteDocument,
    );
    const name = (id: string) => docs.find((d) => d.id === id)?.name ?? id;
    const message = documentsMessage(
      archiving ? "archived" : "deleted",
      done.map(name),
      failed.map(name),
    );
    if (failed.length) toast.error(message);
    else toast.success(message);

    // The finished go from the selection; the failures stay ticked to retry.
    selection?.drop(done);
    setPending(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      // Not closable mid-delete: the requests are already out either way.
      onOpenChange={(next) => !pending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {archiving ? "Archive" : "Delete"} {noun}?
          </DialogTitle>
        </DialogHeader>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {docs.slice(0, LISTED).map((doc) => {
            const href = documentPath(doc);
            return (
              <li key={doc.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{doc.name}</span>
                  {doc.project ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {doc.project}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatFileSize(doc.size)}
                </span>
                {href ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Download ${doc.name}`}
                  >
                    <a href={href} download={doc.name}>
                      <Download aria-hidden />
                    </a>
                  </Button>
                ) : null}
              </li>
            );
          })}
          {docs.length > LISTED ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              +{docs.length - LISTED} more
            </li>
          ) : null}
        </ul>
        {docs.length > 1 ? (
          <p className="-mt-2 text-right text-xs text-muted-foreground tabular-nums">
            Total {formatFileSize(total)}
          </p>
        ) : null}

        {archiving ? (
          <p className="text-sm text-muted-foreground">
            {docs.length === 1 ? "This file moves" : "These files move"} out of
            Documents and into the archive, where{" "}
            {docs.length === 1 ? "it’s" : "they’re"} kept until someone
            unarchives or deletes {docs.length === 1 ? "it" : "them"}.
          </p>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {docs.length === 1 ? "This file" : "These files"} will be removed
              for everyone on this company, including the customer, accounting
              manager and specialist. Deleting is permanent and can’t be undone.
            </p>
            <p>Download a copy first if you may need it.</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            // First in the tab order and focused on open, so a stray Enter
            // cancels rather than starting a delete.
            autoFocus
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {archiving ? (
            <Button disabled={pending} onClick={run}>
              {pending ? <Spinner className="size-4" /> : null}
              {docs.length === 1 ? "Archive" : `Archive ${docs.length}`}
            </Button>
          ) : (
            <HoldToDelete
              label={docs.length === 1 ? "Hold to Delete" : `Hold to Delete ${docs.length}`}
              pending={pending}
              onConfirm={run}
            />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A button that fires only after being held for `HOLD_MS`.
 *
 * The fill sweeps left to right at a constant speed, so how much of the button
 * is red is how much of the hold is done. Let go early and it drains back with
 * nothing deleted. Enter and Space hold it too. Under reduced motion the sweep
 * is replaced by a seconds countdown in the label.
 *
 * The label is drawn twice — muted underneath, white on the fill — and the fill
 * is revealed with `clip-path`, so the text stays readable at every point.
 */
export function HoldToDelete({
  label,
  pending,
  onConfirm,
}: {
  label: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [holding, setHolding] = React.useState(false);
  const [left, setLeft] = React.useState(HOLD_MS / 1000);
  const timer = React.useRef<number | undefined>(undefined);
  const tick = React.useRef<number | undefined>(undefined);

  const stop = React.useCallback(() => {
    window.clearTimeout(timer.current);
    window.clearInterval(tick.current);
    setHolding(false);
    setLeft(HOLD_MS / 1000);
  }, []);

  function start() {
    if (pending || holding) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      stop();
      onConfirm();
    }, HOLD_MS);
    tick.current = window.setInterval(() => setLeft((s) => s - 1), 1000);
  }

  React.useEffect(() => stop, [stop]);

  const text = pending ? "Deleting…" : label;

  return (
    <button
      type="button"
      disabled={pending}
      className="relative h-10 overflow-hidden rounded-lg bg-destructive/10 px-4 text-sm font-medium whitespace-nowrap text-destructive outline-none select-none focus-visible:ring-3 focus-visible:ring-destructive/30 disabled:cursor-wait"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      // A long touch otherwise opens the context menu over the button.
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") stop();
      }}
      onBlur={stop}
    >
      <span className="flex items-center gap-2">
        {pending ? <Spinner className="size-4" /> : null}
        {text}
        {holding ? (
          <span className="hidden tabular-nums motion-reduce:inline">({left})</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center bg-destructive px-4 text-white motion-reduce:hidden"
        style={{
          clipPath: holding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
          transition: holding
            ? `clip-path ${HOLD_MS}ms linear`
            : "clip-path 200ms ease-out",
        }}
      >
        {text}
      </span>
    </button>
  );
}

/**
 * The warning-plus-hold popup behind every Delete Company / Delete Project,
 * whether opened from the record's own page or from a table row.
 *
 * `children` is the warning itself: what goes, and for whom. With `after` it
 * leaves for that page on success, since the one it stood on no longer exists;
 * without it (a list row) it just refreshes.
 */
export function HoldDeleteDialog({
  name,
  open,
  onOpenChange,
  after,
  onDelete,
  children,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  after?: string;
  onDelete: () => Promise<void>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run() {
    setPending(true);
    try {
      await onDelete();
      toast.success(`${name} deleted.`);
      if (after) {
        // Replace, not push: Back shouldn't land on a page that's gone. No
        // refresh() either — it re-renders the current (deleted) route and
        // cancels this navigation.
        router.replace(after);
      } else {
        onOpenChange(false);
        router.refresh();
      }
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : `${name} could not be deleted.`,
      );
      onOpenChange(false);
    }
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
        </DialogHeader>
        {/* Before → after (17 Nov): there, then gone. */}
        <Handover
          ready
          tone="destructive"
          from={
            <Side avatar={<Face name={name} />}>
              <span className="text-sm font-medium">{name}</span>
            </Side>
          }
          to={
            <Side
              avatar={
                <Settle delay>
                  <EmptyFace icon={Trash2} tone="destructive" />
                </Settle>
              }
            >
              <span className="text-sm font-medium text-destructive">Deleted for Good</span>
            </Side>
          }
        />
        <div className="space-y-2 text-center text-sm text-muted-foreground">{children}</div>
        <DialogFooter>
          <Button
            variant="outline"
            // Focused on open, so a stray Enter cancels rather than deletes.
            autoFocus
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <HoldToDelete label="Hold to Delete" pending={pending} onConfirm={run} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** What Delete Project takes, counted when the page knows the counts. */
export function ProjectDeleteWarning({
  tasks,
  documents,
}: {
  tasks?: number;
  documents?: number;
}) {
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const what =
    tasks === undefined || documents === undefined
      ? "its tasks and documents"
      : `${count(tasks, "task")} and ${count(documents, "document")}`;
  return (
    <>
      <p>
        This permanently deletes the project with everything under it — {what},
        archived ones included — for everyone on the company. The company itself
        stays.
      </p>
      <p>Download any documents you may need first.</p>
    </>
  );
}

/**
 * Delete Project, for its creator only — the page decides that (Sir, Q2).
 * Takes everything under the project, never the company (Q4).
 *
 * A header button beside Export CSV (15 Nov), not a red section at the foot.
 */
export function DeleteProject({
  projectId,
  name,
  tasks,
  documents,
  after,
}: {
  projectId: string;
  name: string;
  /** Unknown on a frozen project's page, which reads neither. */
  tasks?: number;
  documents?: number;
  after: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
      <HoldDeleteDialog
        name={name}
        open={open}
        onOpenChange={setOpen}
        after={after}
        onDelete={() => deleteProject(projectId)}
      >
        <ProjectDeleteWarning tasks={tasks} documents={documents} />
      </HoldDeleteDialog>
    </>
  );
}
