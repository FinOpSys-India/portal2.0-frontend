"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Plus, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { SelectField, SubmitButton, TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import type { InviteInput, InviteResult } from "@/lib/admin";

const baseSchema = z.object({
  email: z
    .string()
    .min(1, "Enter an email address.")
    .email("Enter a valid email address."),
  firstName: z.string().min(1, "Enter a first name."),
  lastName: z.string().min(1, "Enter a last name."),
  role: z.string().optional(),
});

type Values = z.infer<typeof baseSchema>;

/**
 * Invite dialog, shared by customers, specialists and accounting managers.
 *
 * All three are the same form in 1.0 — email, first name, last name — with
 * the specialist one adding a role. One component rather than three that
 * drift apart.
 */
export function InviteDialog({
  trigger,
  title,
  emailLabel = "Email Address",
  roles,
  onInvite,
}: {
  trigger: string;
  title: string;
  emailLabel?: string;
  /** Adds a required role select. Specialists only. */
  roles?: readonly string[];
  onInvite: (input: InviteInput) => Promise<InviteResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const schema = React.useMemo(
    () =>
      roles
        ? baseSchema.extend({ role: z.string().min(1, "Select a role.") })
        : baseSchema,
    [roles],
  );

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", firstName: "", lastName: "", role: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: Values) {
    setFailure(null);
    try {
      const { emailSent } = await onInvite(values);

      // Created but not delivered. The backend answers 201 either way and
      // leaves the row PENDING, so closing on a success message would tell the
      // admin someone was invited when nobody was written to.
      if (!emailSent) {
        setFailure(
          `${values.email} was added, but the invitation email could not be sent. They cannot sign up until it reaches them.`,
        );
        router.refresh();
        return;
      }

      setOpen(false);
      form.reset();
      toast.success(`Invitation sent to ${values.email}.`);
      // The new row lives on the server; re-fetch rather than guess at it.
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not send the invite.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setFailure(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          {trigger}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <TextField
              control={form.control}
              name="email"
              label={emailLabel}
              icon={Mail}
              required
              type="email"
              inputMode="email"
              autoFocus
              placeholder="name@company.com"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="firstName"
                label="First Name"
                icon={User}
                required
                placeholder="First name"
              />
              <TextField
                control={form.control}
                name="lastName"
                label="Last Name"
                icon={User}
                required
                placeholder="Last name"
              />
            </div>

            {roles ? (
              <SelectField
                control={form.control}
                name="role"
                label="Role"
                required
                placeholder="Select a role"
                options={roles}
              />
            ) : null}

            <FormAlert>{failure}</FormAlert>

            <SubmitButton pending={form.formState.isSubmitting}>
              Send invite
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
