"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Globe, Mail, Phone, User } from "lucide-react";
import { useForm } from "react-hook-form";

import { AuthHeading } from "@/components/auth/auth-shell";
import {
  AuthCard,
  SelectField,
  StaticField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Form } from "@/components/ui/form";
import { api, type User as Me } from "@/lib/api";
import { userInfoSchema, type UserInfoValues } from "@/lib/schemas";

export function UserInfoForm({ email, me }: { email: string; me: Me }) {
  const router = useRouter();
  const [failure, setFailure] = React.useState<string | null>(null);

  const form = useForm<UserInfoValues>({
    resolver: zodResolver(userInfoSchema),
    defaultValues: { phone: "", jobTitle: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: UserInfoValues) {
    setFailure(null);
    try {
      // The name is echoed back unchanged: `PUT /onboarding/profile` requires
      // all four fields and rejects unknown ones, so it is a full replacement
      // rather than a patch.
      await api.saveUserInfo({
        firstName: me.firstName,
        lastName: me.lastName,
        phone: values.phone,
        jobTitle: values.jobTitle,
      });
      router.push(
        `/on_boarding_form_part_1?email=${encodeURIComponent(email)}`,
      );
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not save your details.",
      );
    }
  }

  return (
    <AuthCard>
      <AuthHeading title="Your details">
        We filled in what your invite already told us. Two things left.
      </AuthHeading>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {/* Everything the invite already knows. Read-only, as in 1.0. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <StaticField label="First Name" value={me.firstName} icon={User} />
            <StaticField label="Last Name" value={me.lastName} />
          </div>

          <StaticField label="Email Address" value={me.email} icon={Mail} />

          <TextField
            control={form.control}
            name="phone"
            label="Phone Number"
            icon={Phone}
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            autoFocus
            numeric
            // E.164 caps a subscriber number at 15 digits.
            maxLength={15}
            placeholder="Enter your phone number"
          />

          {/*
            Job title, not country. 1.0 locked the title (always "Company
            Owner") and asked for a country here; the backend's profile
            endpoint takes the opposite pair — it accepts a job title and has
            nowhere to put a bare country. The full address, country included,
            is collected on the company form on the very next screen.
          */}
          <TextField
            control={form.control}
            name="jobTitle"
            label="Job Title"
            icon={Briefcase}
            required
            autoComplete="organization-title"
            placeholder="e.g. Company Owner"
          />

          <FormAlert>{failure}</FormAlert>

          <div className="pt-2">
            <SubmitButton pending={form.formState.isSubmitting}>
              Continue
            </SubmitButton>
          </div>
        </form>
      </Form>
    </AuthCard>
  );
}
