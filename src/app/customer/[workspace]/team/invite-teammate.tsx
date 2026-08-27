"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Mail, Plus, User } from "lucide-react";
import { useForm } from "react-hook-form";

import { SubmitButton, TextField } from "@/components/auth/fields";
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
import { customerApi } from "@/lib/customer";
import {
  inviteTeammateSchema,
  type InviteTeammateValues,
} from "@/lib/schemas";

export function InviteTeammate({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const form = useForm<InviteTeammateValues>({
    resolver: zodResolver(inviteTeammateSchema),
    defaultValues: { email: "", firstName: "", lastName: "", jobTitle: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: InviteTeammateValues) {
    setFailure(null);
    try {
      await customerApi.inviteTeammate(workspaceId, values);
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not send the invite.",
      );
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
          Invite teammate
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
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
              label="Email Address"
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

            <TextField
              control={form.control}
              name="jobTitle"
              label="Job Title"
              icon={Briefcase}
              required
              placeholder="e.g. Office Manager"
            />

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
