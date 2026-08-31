"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, CalendarDays, FolderKanban, Plus, Wrench } from "lucide-react";
import { useForm } from "react-hook-form";

import { SelectField, SubmitButton, TextField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { managerApi } from "@/lib/manager";
import { managerProjectSchema, type ManagerProjectValues } from "@/lib/schemas";

/**
 * Open a project on one of the manager's own companies.
 *
 * The customer's dialog is one company by construction — the workspace is the
 * URL. This one is not, so it asks, and the SERVICE LIST DEPENDS ON THE ANSWER:
 * each company pays for a different set, and the endpoint refuses a service the
 * company has not bought. Fetching the list per company at open time rather
 * than pre-loading every company's on the page behind it is one request instead
 * of one per account on the book, on a page most visits never open this from.
 */
export function NewProject({
  companies,
  defaultCompanyId,
}: {
  companies: { id: string; name: string }[];
  /** The header switcher's selection, when it has one. */
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [services, setServices] = React.useState<string[] | null>(null);

  // Scoped to one company, or holding exactly one: there is nothing to choose,
  // so the field is filled rather than asked.
  const only = defaultCompanyId ?? (companies.length === 1 ? companies[0].id : "");

  const form = useForm<ManagerProjectValues>({
    resolver: zodResolver(managerProjectSchema),
    defaultValues: { companyId: only, name: "", service: "", deadline: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const companyId = form.watch("companyId");

  /*
   * The service list follows the company. Reset alongside it — a service picked
   * for one account is meaningless on the next, and leaving the old value in
   * place submits a name the new company does not have.
   */
  React.useEffect(() => {
    if (!open || !companyId) {
      setServices(null);
      return;
    }

    let live = true;
    setServices(null);
    // Cleared, not merely re-listed: "Payroll" picked on one company is a
    // different plan id on the next and may not be sold there at all, so
    // leaving the old selection in place submits a name the new company does
    // not have — a 400 from a form that looked filled in.
    form.setValue("service", "");
    managerApi
      .availableServices(companyId)
      .then((rows) => {
        if (live) setServices(rows);
      })
      .catch(() => {
        if (live) setServices([]);
      });

    return () => {
      live = false;
    };
  }, [open, companyId, form]);

  function reset() {
    form.reset({ companyId: only, name: "", service: "", deadline: "" });
    setFailure(null);
    setServices(null);
  }

  async function onSubmit(values: ManagerProjectValues) {
    setFailure(null);
    try {
      await managerApi.createProject(values.companyId, values);
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not create the project.",
      );
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
      {/* Not DialogTrigger: the header renders this beside a table and the
          trigger has to keep its own click target above the row links. */}
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        New project
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {/* Hidden when the scope already decided it — a select of one is a
                control that cannot be used. */}
            {only ? null : (
              <SelectField
                control={form.control}
                name="companyId"
                label="Company"
                icon={Building2}
                required
                placeholder="Select a company"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}

            <TextField
              control={form.control}
              name="name"
              label="Project Name"
              icon={FolderKanban}
              required
              autoFocus
              placeholder="e.g. August payroll run"
            />

            {/* Only what the chosen company actually pays for. Offering more
                would be offering options the write refuses. */}
            <SelectField
              control={form.control}
              name="service"
              label="Service"
              icon={Wrench}
              required
              disabled={!companyId || services === null || services.length === 0}
              placeholder={
                !companyId
                  ? "Pick a company first"
                  : services === null
                    ? "Loading services…"
                    : services.length === 0
                      ? "No active services on this company"
                      : "Select a service"
              }
              options={services ?? []}
            />

            <TextField
              control={form.control}
              name="deadline"
              label="Deadline"
              icon={CalendarDays}
              required
              type="date"
              // Today is blocked as well as the past, matching the customer's
              // form and 1.0's picker.
              min={tomorrow()}
            />

            <FormAlert>{failure}</FormAlert>

            <SubmitButton pending={form.formState.isSubmitting}>
              Create project
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
