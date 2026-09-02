"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, UploadCloud, X } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  SelectField,
  StaticField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { customerApi } from "@/lib/customer";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  acceptAttachments,
  formatFileSize,
  MAX_EMAIL_ATTACHMENT_LABEL,
  MAX_EMAIL_ATTACHMENTS,
  managerApi,
} from "@/lib/manager";
import { connectEmailSchema, type ConnectEmailValues } from "@/lib/schemas";
import { specialistApi } from "@/lib/specialist";
import { cn } from "@/lib/utils";

/**
 * Which portal is writing. Named rather than passed as a function: the callers
 * are Server Components, and a function cannot cross that boundary.
 */
const SEND = {
  manager: managerApi.sendEmail,
  specialist: specialistApi.sendEmail,
  customer: customerApi.sendEmail,
};

/**
 * Connect → Email compose, 1.0's screen: To, Subject, Message, an attachment
 * dropzone, then Send and a discard button.
 *
 * Replaces the conversation table that used to sit here. 1.0 has no email
 * inbox — Send Email opens a blank compose form and there is nowhere to read a
 * reply, so this does not invent a mailbox the backend cannot fill.
 *
 * `fixedTo` is the specialist's case: they have exactly one counterparty by
 * design, so the design draws the recipient as a chip. It is a separate prop
 * rather than "a list of one" — the manager's list can also happen to hold one
 * name, and that must stay a dropdown.
 */
export function EmailCompose({
  recipients = [],
  fixedTo,
  from,
  companyId,
}: {
  recipients?: { value: string; label: string }[];
  fixedTo?: { value: string; label: string };
  from: keyof typeof SEND;
  /**
   * Which company the mail is sent from — REQUIRED for a customer, and it was
   * not being passed.
   *
   * Left out, `sendEmailAs` falls back to the first company on the caller's
   * book, and that fallback reads `GET /accounting-manager/companies`: an
   * ACCOUNTING_MANAGER-only route. A customer's Send therefore 403'd before it
   * ever reached `POST /emails` — on the one screen they have for writing to
   * their accountant.
   */
  companyId?: string;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<ConnectEmailValues>({
    resolver: zodResolver(connectEmailSchema),
    defaultValues: { to: fixedTo?.value ?? "", subject: "", message: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const none = !fixedTo && recipients.length === 0;

  function add(chosen: File[]) {
    setSent(false);
    if (!chosen.length) return;

    const { files: next, refused } = acceptAttachments(files, chosen);
    setFiles(next);
    setFailure(refused.length ? refused.join(" ") : null);
  }

  function discard() {
    form.reset();
    setFiles([]);
    setFailure(null);
    setSent(false);
  }

  async function onSubmit(values: ConnectEmailValues) {
    setFailure(null);
    try {
      await SEND[from]({ ...values, companyId, files });
      form.reset();
      setFiles([]);
      setSent(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not send.");
    }
  }

  return (
    <>
      <div className="mb-6">
        {/* The pill IS this page's title, so it is the h1 rather than a span —
            compose is the whole screen and nothing above it names it.
            inline-block keeps the h1's block display from stretching the
            border across the column. */}
        <h1 className="inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold">
          Email
        </h1>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
            // Any edit clears the confirmation: it described the last send,
            // not the draft now on screen.
            onChange={() => setSent(false)}
          >
            {fixedTo ? (
              <StaticField label="To" value={fixedTo.label} />
            ) : (
              <SelectField
                control={form.control}
                name="to"
                label="To"
                required
                placeholder={none ? "Nobody to write to" : "Choose an option…"}
                options={recipients}
                disabled={none}
              />
            )}

            <TextField
              control={form.control}
              name="subject"
              label="Subject"
              required
              placeholder="Subject"
            />

            <TextareaField
              control={form.control}
              name="message"
              label="Message"
              required
              rows={8}
              placeholder="Message"
            />

            {/*
              An explicit button, not a <label> around a hidden input — the same
              construction the documents dialog settled on, because the click a
              <label> forwards is what stops arriving once this sits inside
              other form machinery. `role`/`tabIndex`/`onKeyDown` put back what
              dropping the <label> costs: reachable by Tab, operable by Enter
              and Space.

              Both drag handlers must preventDefault or the browser NAVIGATES to
              the dropped file, replacing the half-written message with a PDF.
            */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Attach files to this email"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                add(Array.from(event.dataTransfer.files ?? []));
              }}
              className={cn(
                "grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center transition-colors duration-150 hover:border-primary/70 focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none",
                dragging ? "border-primary bg-primary/5" : "border-primary/40",
              )}
            >
              <UploadCloud
                className="size-8 text-muted-foreground"
                aria-hidden
              />
              <span className="text-sm text-muted-foreground">
                Drag and drop files here or browse
              </span>
              {/* The limits belong next to the control they constrain. */}
              <span className="text-xs text-muted-foreground">
                PDF, Word, Excel, CSV, text or images · up to{" "}
                {MAX_EMAIL_ATTACHMENTS} files, {MAX_EMAIL_ATTACHMENT_LABEL} in
                total
              </span>
              <input
                ref={inputRef}
                type="file"
                multiple
                tabIndex={-1}
                className="sr-only"
                accept={ACCEPTED_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(
                  ",",
                )}
                onChange={(event) => {
                  add(Array.from(event.target.files ?? []));
                  // Cleared so picking the SAME file again still fires `change`
                  // — otherwise a file removed from the list below could never
                  // be re-added, and the control would just stop responding.
                  event.target.value = "";
                }}
              />
            </div>

            {files.length ? (
              <ul className="grid gap-2">
                {files.map((file) => (
                  <li
                    key={`${file.name}:${file.size}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                      {formatFileSize(file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        setFiles((rows) => rows.filter((f) => f !== file));
                        setFailure(null);
                      }}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <FormAlert>{failure}</FormAlert>

            {sent ? (
              <p role="status" className="text-sm text-muted-foreground">
                Sent. 1.0 has no sent folder, so there is nothing to open
                afterwards.
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <SubmitButton
                pending={form.formState.isSubmitting}
                disabled={none}
                className="w-auto px-6"
              >
                Send
              </SubmitButton>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={discard}
                aria-label="Discard this draft"
                className="size-11"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </form>
        </Form>
      </section>
    </>
  );
}
