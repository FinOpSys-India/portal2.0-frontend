"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { SelectField, SubmitButton } from "@/components/auth/fields";
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
import { managerApi, type Specialist } from "@/lib/manager";
import {
  assignSpecialistsSchema,
  type AssignSpecialistsValues,
} from "@/lib/schemas";

/**
 * Company-level specialist assignment — one specialist per service, the only
 * assignment surface 1.0 gives a manager.
 *
 * The service labels are 1.0's, including its spelling: this modal writes
 * "Bookkeeping" where admin's invite modal writes "Bookkeping". The mismatch
 * is real and recorded in docs/am-portal.md; matching admin here would hide it.
 */
const SERVICES = [
  { name: "bookkeeping", label: "Bookkeeping Specialist" },
  { name: "payroll", label: "Payroll Specialist" },
  { name: "tax", label: "Tax Specialist" },
] as const;

export function AssignCompanySpecialist({
  companyId,
  companyName,
  specialists,
}: {
  companyId: string;
  companyName: string;
  specialists: Specialist[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const form = useForm<AssignSpecialistsValues>({
    resolver: zodResolver(assignSpecialistsSchema),
    defaultValues: { bookkeeping: "", payroll: "", tax: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const options = specialists.map((s) => ({ value: s.email, label: s.name }));
  const none = options.length === 0;

  async function onSubmit(values: AssignSpecialistsValues) {
    setFailure(null);
    try {
      await managerApi.assignCompanySpecialists(companyId, values);
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not save.");
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
        {/* relative z-10 keeps the trigger above the row's own click target. */}
        <Button variant="outline" size="sm" className="relative z-10">
          Assign Specialist
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign specialists to {companyName}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {SERVICES.map((service) => (
              <SelectField
                key={service.name}
                control={form.control}
                name={service.name}
                label={service.label}
                placeholder={
                  none ? "No specialists available" : "Select your specialist"
                }
                options={options}
                disabled={none}
              />
            ))}

            <FormAlert>{failure}</FormAlert>

            <SubmitButton
              pending={form.formState.isSubmitting}
              disabled={none}
            >
              Save
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
