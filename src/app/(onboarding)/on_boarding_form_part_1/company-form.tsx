"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { AuthHeading, BackToLogin } from "@/components/auth/auth-shell";
import { AuthCard, SubmitButton } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { CompanyFields } from "@/components/portal/company-fields";
import { Form } from "@/components/ui/form";
import { api } from "@/lib/api";
import { companyInput } from "@/lib/company";
import { DEFAULT_COUNTRY } from "@/lib/countries";
import { companySchema, type CompanyValues } from "@/lib/schemas";

export function CompanyForm({ accountEmail }: { accountEmail: string }) {
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
    <AuthCard>
      <div className="mb-6">
        <BackToLogin />
      </div>

      <AuthHeading title="Your company">
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
