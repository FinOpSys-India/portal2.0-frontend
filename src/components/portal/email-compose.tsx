"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, UploadCloud } from "lucide-react";
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
import { managerApi } from "@/lib/manager";
import { connectEmailSchema, type ConnectEmailValues } from "@/lib/schemas";
import { specialistApi } from "@/lib/specialist";

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

  const form = useForm<ConnectEmailValues>({
    resolver: zodResolver(connectEmailSchema),
    defaultValues: { to: fixedTo?.value ?? "", subject: "", message: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const none = !fixedTo && recipients.length === 0;

  async function onSubmit(values: ConnectEmailValues) {
    setFailure(null);
    try {
      await SEND[from]({ ...values, companyId });
      form.reset();
      setSent(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not send.");
    }
  }

  return (
    <>
      <div className="mb-6">
        <span className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold">
          Email
        </span>
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

            {/* Needs file storage the backend does not have yet. Rendered so
                the screen matches 1.0, inert so it cannot fail on click. */}
            <div
              aria-disabled
              className="grid place-items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-muted/30 px-6 py-10 text-center opacity-60"
            >
              <UploadCloud
                className="size-8 text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                Attachments arrive with file storage
              </p>
            </div>

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
                onClick={() => {
                  form.reset();
                  setFailure(null);
                  setSent(false);
                }}
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
