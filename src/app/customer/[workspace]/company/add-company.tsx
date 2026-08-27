"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";

import { SubmitButton } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { CompanyFields } from "@/components/portal/company-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { api } from "@/lib/api";
import { companyInput } from "@/lib/company";
import { DEFAULT_COUNTRY } from "@/lib/countries";
import { companySchema, type CompanyValues } from "@/lib/schemas";

/**
 * Add Company — the same three steps a first company goes through, entered
 * from the portal instead of from signup: details here, then plan, then
 * checkout.
 *
 * Only the details step is a dialog. The plan step is a full page of priced
 * cards that hands off to Stripe, and onboarding already owns that route — so
 * this posts the company and hands the new id straight to it rather than
 * rebuilding the pricing table inside a modal.
 */
export function AddCompany({ accountEmail }: { accountEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  /**
   * One key per opened dialog, so a double-submit or a retry after a dropped
   * response replays the first 201 instead of creating a second company.
   * Re-keyed on close, because the next open is a different company.
   */
  const [idempotencyKey, setIdempotencyKey] = React.useState(() =>
    crypto.randomUUID(),
  );

  // The schema closes over the account email so it can reject a duplicate.
  const schema = React.useMemo(
    () => companySchema(accountEmail),
    [accountEmail],
  );

  const form = useForm<CompanyValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "",
      addressLine1: "",
      city: "",
      zip: "",
      state: "",
      country: DEFAULT_COUNTRY,
      email: "",
      phone: "",
      employees: "",
      revenue: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: CompanyValues) {
    setFailure(null);
    try {
      const { company } = await api.createCompany(
        companyInput(values),
        idempotencyKey,
      );
      // Left open until the route changes: closing first would flash the
      // company list, which does not hold the new company until it is paid for.
      router.push(
        `/on_boarding_form_part_2?email=${encodeURIComponent(accountEmail)}&compID=${encodeURIComponent(company.id)}`,
      );
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not save your company.",
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
          setIdempotencyKey(crypto.randomUUID());
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Add Company
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a company</DialogTitle>
          <DialogDescription>
            Tell us about the business, then pick its plan.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <CompanyFields control={form.control} autoFocus />

            <FormAlert>{failure}</FormAlert>

            <SubmitButton pending={form.formState.isSubmitting}>
              Choose Your Plan
            </SubmitButton>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
