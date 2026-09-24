"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { AuthHeading, BackLink } from "@/components/auth/auth-shell";
import { AuthCard, SubmitButton } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { CompanyFields } from "@/components/portal/company-fields";
import { Form } from "@/components/ui/form";
import { api } from "@/lib/api";
import { applyCompanyFieldErrors, companyInput } from "@/lib/company";
import { companySchema, type CompanyValues } from "@/lib/schemas";

export function CompanyForm({
  accountEmail,
  companyId,
  initial,
}: {
  accountEmail: string;
  /**
   * Set when this company already exists — the user walked back into this step.
   * The form then EDITS it; see `onSubmit`.
   */
  companyId?: string;
  /** What that company holds today, so going back does not mean retyping. */
  initial?: CompanyValues;
}) {
  const router = useRouter();
  const [failure, setFailure] = React.useState<string | null>(null);

  /**
   * One key per mounted form, so a double-submit or a retry after a dropped
   * response replays the first 201 instead of creating a second company. A new
   * key per attempt would defeat the point.
   */
  const idempotencyKey = React.useMemo(() => crypto.randomUUID(), []);

  // The schema closes over the account email so it can reject a duplicate.
  const schema = React.useMemo(
    () => companySchema(accountEmail),
    [accountEmail],
  );

  const form = useForm<CompanyValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? {
      name: "",
      type: "",
      enNumber: "",
      addressLine1: "",
      city: "",
      zip: "",
      state: "",
      country: "",
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
      // Create the first time through, correct it on every later one. Posting
      // again would leave the user owning two companies, and the idempotency
      // key cannot save them: replaying the original response is the one answer
      // that is certainly wrong once the point was to change something.
      let id = companyId;
      if (id) {
        await api.updateCompany(id, companyInput(values));
      } else {
        const { company } = await api.createCompany(
          companyInput(values),
          idempotencyKey,
        );
        id = String(company.id);
      }
      router.push(
        `/on_boarding_form_part_2?email=${encodeURIComponent(accountEmail)}&compID=${encodeURIComponent(id)}`,
      );
    } catch (err) {
      // Anything the server named a field for lands on that field; what is
      // left — a rejection about something this form does not render — is
      // appended to the alert rather than dropped.
      const stray = applyCompanyFieldErrors(err, form.setError);
      const message =
        err instanceof Error ? err.message : "Could not save your company.";
      setFailure(stray.length ? `${message} (${stray.join("; ")})` : message);
    }
  }

  return (
    <AuthCard>
      {/* One step back, not out of the flow: step 1 reopens on what was saved
          there, and coming forward again returns to this same company. */}
      <div className="mb-6">
        <BackLink
          href={`/on_boarding_form_user_info/${encodeURIComponent(accountEmail)}`}
        >
          Back
        </BackLink>
      </div>

      <AuthHeading title="Your Company">
        Tell us about the business we&rsquo;ll be working on.
      </AuthHeading>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <CompanyFields control={form.control} autoFocus />

          <FormAlert>{failure}</FormAlert>

          <div className="pt-2">
            <SubmitButton pending={form.formState.isSubmitting}>
              Choose Your Plan
            </SubmitButton>
          </div>
        </form>
      </Form>
    </AuthCard>
  );
}
