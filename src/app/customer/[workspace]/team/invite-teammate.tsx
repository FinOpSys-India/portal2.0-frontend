"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Building2, ChevronDown, Mail, Plus, User } from "lucide-react";
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
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { customerApi, type Workspace } from "@/lib/customer";
import {
  inviteTeammateSchema,
  type InviteTeammateValues,
} from "@/lib/schemas";

/** What the closed trigger says. Names while they fit, a count once they do not. */
function summarize(selected: string[], companies: Workspace[]): string {
  if (selected.length === 0) return "Select companies";
  if (selected.length > 2) return `${selected.length} companies`;
  // Ordered by the list rather than by when each box was ticked, so the trigger
  // reads the same as the menu behind it.
  return companies
    .filter((c) => selected.includes(c.id))
    .map((c) => c.name)
    .join(", ");
}

/**
 * Invite a teammate onto one or more of the owner's companies.
 *
 * The company list is the point of the dialog, not decoration: an invitation
 * is what creates the teammate's `company_members` rows at sign-up, so the
 * boxes ticked here are the whole of what that person will ever be able to
 * open. It used to be the workspace in the URL and nothing else.
 */
export function InviteTeammate({
  workspaceId,
  companies,
}: {
  workspaceId: string;
  /** Every company the signed-in owner holds — `customerApi.workspaces()`. */
  companies: Workspace[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  /*
   * The open workspace starts ticked — inviting someone onto the company you
   * are looking at is the common case — but only when it is one of the
   * companies offered.
   *
   * The guard is not defensive noise: once the backend counts `company_members`
   * a customer reaches companies they do NOT own, and the invite list is
   * owner-only. Ticking the open workspace unconditionally would then pre-select
   * an id absent from the menu — a box the owner cannot see or untick, sent to
   * an endpoint that answers 403 COMPANY_ACCESS_DENIED.
   */
  const defaults: InviteTeammateValues = {
    email: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    companyIds: companies.some((c) => c.id === workspaceId)
      ? [workspaceId]
      : [],
  };

  const form = useForm<InviteTeammateValues>({
    resolver: zodResolver(inviteTeammateSchema),
    defaultValues: defaults,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: InviteTeammateValues) {
    setFailure(null);
    try {
      await customerApi.inviteTeammate(values);
      setOpen(false);
      form.reset(defaults);
      toast.success(`Invitation sent to ${values.email}.`);
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
          form.reset(defaults);
          setFailure(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Invite Teammate
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a Teammate</DialogTitle>
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

            <FormField
              control={form.control}
              name="companyIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Company Access
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  </FormLabel>

                  {/* A dropdown rather than an always-open checklist: this sits
                      between Email and Job Title, and four companies' worth of
                      checkboxes pushes the form's last field and its button off
                      a laptop screen. Collapsed, the row reads like the fields
                      above it and the trigger still says what is granted. */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "relative flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card pr-3.5 pl-10 text-left text-sm",
                          "transition-[border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                          "hover:border-primary/35 data-[state=open]:border-primary",
                          "focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                          // A button cannot carry aria-invalid, so the failed
                          // state is the border alone; `FormMessage` below is
                          // what actually announces it.
                          form.formState.errors.companyIds &&
                            "border-destructive",
                        )}
                      >
                        <Building2
                          aria-hidden
                          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <span
                          className={cn(
                            "flex-1 truncate",
                            field.value.length === 0 && "text-muted-foreground",
                          )}
                        >
                          {summarize(field.value, companies)}
                        </span>
                        <ChevronDown
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </button>
                    </PopoverTrigger>

                    <PopoverContent
                      align="start"
                      className="max-h-64 w-(--radix-popover-trigger-width) gap-1 overflow-y-auto p-1.5"
                    >
                      {/* ponytail: no search box. `/companies/owned` is
                          unpaginated because an owner holds a handful; add one
                          if that stops being true. */}
                      {companies.map((company) => {
                        const checked = field.value.includes(company.id);
                        return (
                          <label
                            key={company.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 accent-primary"
                              checked={checked}
                              onChange={() =>
                                field.onChange(
                                  checked
                                    ? field.value.filter(
                                        (id) => id !== company.id,
                                      )
                                    : [...field.value, company.id],
                                )
                              }
                            />
                            <span className="truncate">{company.name}</span>
                          </label>
                        );
                      })}
                    </PopoverContent>
                  </Popover>

                  <FormDescription>
                    They will be able to open every company you tick. No role to
                    pick — an invited teammate joins as a member.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormAlert>{failure}</FormAlert>

            <SubmitButton pending={form.formState.isSubmitting}>
              Send Invite
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
