"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { fileKind, formatFileSize } from "@/lib/manager";
import { deleteDocument, documentPath } from "@/lib/portal";
import { cn } from "@/lib/utils";

/**
 * What a browser can render, and the type the bytes are handed back as.
 *
 * THE TYPE IS OURS, NOT THE SERVER'S, and that is the security of this file.
 * A blob URL inherits this origin, so a .pdf that is really HTML would run
 * against it if the response's own Content-Type decided the viewer. Typed from
 * the extension instead, such a file reaches the PDF viewer and fails there,
 * which is the whole of the damage.
 *
 * Everything else the server accepts — doc, docx, xls, xlsx — has no viewer
 * without a converter, so those offer the download instead of a broken frame.
 */
const VIEWERS: Record<string, { as: "pdf" | "image" | "text"; type: string }> = {
  pdf: { as: "pdf", type: "application/pdf" },
  png: { as: "image", type: "image/png" },
  jpg: { as: "image", type: "image/jpeg" },
  jpeg: { as: "image", type: "image/jpeg" },
  webp: { as: "image", type: "image/webp" },
  heic: { as: "image", type: "image/heic" },
  txt: { as: "text", type: "text/plain" },
  csv: { as: "text", type: "text/plain" },
};

/**
 * A file name that opens the file.
 *
 * The name IS the control, on every list that shows one: a row already reads as
 * the file, and a second "Preview" cell beside it would say the same thing
 * twice. Where there is nothing to open — a document carrying no project, so no
 * authorized URL exists for it — it renders as the plain text it was before.
 */
export function FilePreview({
  name,
  href,
  size,
  className,
}: {
  name: string;
  /** `documentPath(row)` — null when the row has no readable URL. */
  href: string | null;
  /** Shown beside the title, so the dialog says what is loading. */
  size?: number;
  className?: string;
}) {
  if (!href) return <span className={className}>{name}</span>;

  return (
    <PreviewDialog name={name} href={href} size={size}>
      <button
        type="button"
        aria-label={`Preview ${name}`}
        className={cn(
          "truncate text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
          className,
        )}
      >
        {name}
      </button>
    </PreviewDialog>
  );
}

/**
 * The viewer itself, opened by whatever is passed as its trigger — the file
 * name in a list, the eye in the actions column. One dialog either way, so the
 * two entry points cannot drift.
 */
function PreviewDialog({
  name,
  href,
  size,
  children,
}: {
  name: string;
  href: string;
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{name}</DialogTitle>
          <p className="text-xs text-muted-foreground tabular-nums">
            {fileKind(name)}
            {size === undefined ? "" : ` · ${formatFileSize(size)}`}
          </p>
        </DialogHeader>

        <PreviewBody name={name} href={href} />

        <Button asChild variant="outline" className="justify-self-start">
          <a href={href} download={name}>
            <Download aria-hidden />
            Download
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The row's controls: preview, download, and — for your own uploads — delete.
 *
 * DELETE IS THE UPLOADER'S ALONE here. The server allows more (anyone with
 * write access to the project may remove a file), but "you can delete what you
 * put there" is a rule a reader can predict from the row in front of them,
 * where "you can delete this one because of your role on its project" is not.
 * The narrower button is not a security claim — the server still decides.
 */
export function DocumentActions({
  doc,
  viewerId,
}: {
  doc: {
    id: string;
    projectId: string | null;
    name: string;
    ownerId: string | null;
    size: number;
  };
  /** The signed-in user, from `viewerId()`. */
  viewerId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const href = documentPath(doc);
  const mine = doc.ownerId !== null && doc.ownerId === viewerId;

  async function remove() {
    if (!doc.projectId || pending) return;
    // Deleting the bytes is not undoable — the row is kept for history, the
    // object in the bucket is not — so it is worth one question.
    if (!window.confirm(`Delete ${doc.name}? This cannot be undone.`)) return;

    setPending(true);
    try {
      await deleteDocument(doc.projectId, doc.id);
      toast.success(`${doc.name} deleted.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That file could not be deleted.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="flex items-center justify-end gap-1">
      {href ? (
        <>
          <PreviewDialog name={doc.name} href={href} size={doc.size}>
            <Button variant="ghost" size="icon-sm" aria-label={`Preview ${doc.name}`}>
              <Eye aria-hidden />
            </Button>
          </PreviewDialog>

          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label={`Download ${doc.name}`}
          >
            <a href={href} download={doc.name}>
              <Download aria-hidden />
            </a>
          </Button>
        </>
      ) : null}

      {mine ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={remove}
          disabled={pending}
          aria-label={`Delete ${doc.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          {pending ? <Spinner className="size-4" /> : <Trash2 aria-hidden />}
        </Button>
      ) : null}
    </span>
  );
}

/**
 * The bytes, fetched when the dialog opens (Radix mounts this only then).
 *
 * FETCHED RATHER THAN FRAMED. The download route sets
 * `Content-Disposition: attachment` — directly, and again on the signed link it
 * redirects to — so an `<iframe src>` pointed at it saves the file instead of
 * showing it. Reading it here and re-typing it as a blob is what turns the same
 * authorized URL into something a viewer can render.
 */
function PreviewBody({ name, href }: { name: string; href: string }) {
  const viewer = VIEWERS[fileKind(name).toLowerCase()];
  const [url, setUrl] = React.useState<string | null>(null);
  const [text, setText] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!viewer) return;

    let objectUrl: string | null = null;
    let live = true;

    (async () => {
      try {
        const res = await fetch(href);
        if (!res.ok) throw new Error(`Request failed (HTTP ${res.status}).`);

        const blob = new Blob([await res.arrayBuffer()], { type: viewer.type });
        if (!live) return;

        if (viewer.as === "text") {
          setText(await blob.text());
        } else {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch {
        // The reason is never actionable from here — an expired session, a
        // deleted object, a bucket that declines a cross-origin read — and the
        // download below works in every one of those cases it can.
        if (live) setFailure("This file could not be loaded.");
      }
    })();

    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [href, viewer]);

  const frame = "h-[60vh] w-full rounded-lg border border-border bg-muted";

  if (!viewer)
    return <Note>{fileKind(name)} files cannot be previewed here.</Note>;
  if (failure) return <Note>{failure}</Note>;

  if (text !== null)
    return (
      <pre className={cn(frame, "overflow-auto p-4 font-mono text-xs")}>
        {text}
      </pre>
    );

  if (url && viewer.as === "pdf")
    return <iframe src={url} title={name} className={frame} />;

  if (url)
    return (
      // A blob of our own making, not a remote URL: there is nothing for
      // next/image to optimise and no width known before it loads.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        onError={() => setFailure("This file could not be displayed.")}
        className={cn(frame, "object-contain")}
      />
    );

  return (
    <div className={cn(frame, "flex items-center justify-center")}>
      <Spinner className="size-6" />
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
