"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, UploadCloud } from "lucide-react";

import { SubmitButton } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  fileKind,
  formatFileSize,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/lib/manager";

/**
 * The constraints the design writes down (docs/specialist-portal.md). They are
 * repeated here so the reader is told before the upload fails, not after — but
 * they are a courtesy, not a control. The server has to enforce both; anything
 * checked only in a browser is a suggestion.
 */
/**
 * Extensions the SERVER accepts, mirroring `utils/documentTypes.js`.
 *
 * The old list was narrower than the backend's and refused files it would have
 * taken — PNG most obviously, which is what most screenshots and photographed
 * receipts are. An allowlist that disagrees with the server in this direction
 * is invisible: the upload never happens, so nothing logs a rejection.
 */
const ACCEPT = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
];

export type UploadMeta = { companyId: string; project: string | null };

/**
 * Upload dialog, shared by the three portals that have a file list.
 *
 * Each portal posts to its own endpoint with its own scope, so the call comes
 * in as a prop; everything above it — the drop area, the limits, the pending
 * state — is the same dialog three times over otherwise.
 */
export function UploadFile({
  companies,
  projects,
  projectRequired = false,
  upload,
}: {
  /** Company picker. Omit where the portal is already scoped to one. */
  companies?: { id: string; name: string }[];
  /** Project names, which is what a document carries. */
  projects: { name: string; companyId?: string }[];
  /** Where a file cannot exist unattached — the customer's own file list. */
  projectRequired?: boolean;
  upload: (file: File, meta: UploadMeta) => Promise<unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [companyId, setCompanyId] = React.useState(
    companies?.length === 1 ? companies[0].id : "",
  );
  const [project, setProject] = React.useState("");
  const [failure, setFailure] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setCompanyId(companies?.length === 1 ? companies[0].id : "");
    setProject("");
    setFailure(null);
  }

  // A project belongs to one company, so switching company invalidates the
  // pick rather than silently filing the upload under the wrong project.
  const forCompany = companies
    ? projects.filter((p) => p.companyId === companyId)
    : projects;

  function choose(next: File | null) {
    setFailure(null);
    if (!next) return setFile(null);

    if (!ACCEPT.includes(fileKind(next.name).toLowerCase())) {
      setFailure(`${fileKind(next.name)} files are not supported.`);
      return setFile(null);
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setFailure(
        `That file is ${formatFileSize(next.size)}. The limit is ${MAX_UPLOAD_LABEL}.`,
      );
      return setFile(null);
    }
    setFile(next);
  }

  const incomplete =
    !file || (!!companies && !companyId) || (projectRequired && !project);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || incomplete || pending) return;

    setPending(true);
    setFailure(null);
    try {
      await upload(file, { companyId, project: project || null });
      setOpen(false);
      reset();
      // The new row lives on the server; re-fetch rather than guess at it.
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not upload.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          disabled={
            companies ? companies.length === 0 : projectRequired && projects.length === 0
          }
        >
          <Upload className="size-4" aria-hidden />
          Upload File
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/*
            An explicit button, not a <label> wrapping a hidden input.
            The label form relies on the browser forwarding a click to an input
            it is nested around, which is exactly the behaviour that was not
            happening inside the dialog — so the picker is opened by hand
            instead. `role`/`tabIndex`/`onKeyDown` put back what dropping the
            <label> would otherwise cost: reachable by Tab, operable by Enter
            and Space.
          */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a file to upload"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            // Both handlers must preventDefault or the browser NAVIGATES to the
            // dropped file — the default that made "drag and drop" look broken
            // rather than absent. There were no drop handlers here at all.
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center transition-colors duration-150 hover:border-primary/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
              dragging ? "border-primary bg-primary/5" : "border-primary/40",
            )}
          >
            <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
            {file ? (
              <span className="text-sm font-medium">
                {file.name}
                <span className="ml-2 text-muted-foreground tabular-nums">
                  {formatFileSize(file.size)}
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Drag and drop your file here or browse
              </span>
            )}
            {/* The limits belong next to the control they constrain, not in a
                subheading two elements above it. */}
            <span className="text-xs text-muted-foreground">
              PDF, Word, Excel, CSV, text or images · up to {MAX_UPLOAD_LABEL}
            </span>
            <input
              ref={inputRef}
              type="file"
              tabIndex={-1}
              className="sr-only"
              accept={ACCEPT.map((ext) => `.${ext}`).join(",")}
              onChange={(event) => {
                choose(event.target.files?.[0] ?? null);
                // Cleared so picking the SAME file again still fires `change`.
                // Without it a file rejected for size or type could not be
                // re-selected — the value had not changed, so no event fired
                // and the dialog simply stopped responding.
                event.target.value = "";
              }}
            />
          </div>

          {companies ? (
            <Field label="Company" required>
              <Select
                value={companyId}
                onValueChange={(id) => {
                  setCompanyId(id);
                  setProject("");
                }}
              >
                <SelectTrigger aria-label="Company" className="h-11 w-full rounded-lg bg-card">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {/* Optional in the staff portals, unlike the design's required Select
              Project: a file can arrive before there is a project to attach it
              to, which is a case the data model already carries. */}
          <Field label="Project" required={projectRequired}>
            <Select
              value={project}
              onValueChange={setProject}
              disabled={forCompany.length === 0}
            >
              <SelectTrigger aria-label="Project" className="h-11 w-full rounded-lg bg-card">
                <SelectValue
                  placeholder={
                    companies && !companyId
                      ? "Pick a company first"
                      : forCompany.length === 0
                        ? "No projects here yet"
                        : projectRequired
                          ? "Select a project"
                          : "Leave unattached"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {forCompany.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FormAlert>{failure}</FormAlert>

          <SubmitButton pending={pending} disabled={incomplete}>
            Upload
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm leading-none font-medium">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        ) : null}
      </span>
      {children}
    </div>
  );
}
