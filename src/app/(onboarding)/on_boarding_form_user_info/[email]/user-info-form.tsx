"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Globe, Mail, Phone, User } from "lucide-react";
import { useForm } from "react-hook-form";

import { AuthHeading } from "@/components/auth/auth-shell";
import {
  AuthCard,
  PhoneField,
  SelectField,
  StaticField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Form } from "@/components/ui/form";
import { api, type User as Me } from "@/lib/api";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";
import { userInfoSchema, type UserInfoValues } from "@/lib/schemas";

export function UserInfoForm({ email, me }: { email: string; me: Me }) {
  const router = useRouter();
  const [failure, setFailure] = React.useState<string | null>(null);

  const form = useForm<UserInfoValues>({
    resolver: zodResolver(userInfoSchema),
    defaultValues: { phone: "", phoneCountry: DEFAULT_COUNTRY, jobTitle: "" },
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
      <AuthHeading title="Your Details">
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

          {/*
            The country 1.0 asks for here, kept for the phone alone: it picks
            the dialling code and the number of digits the field will accept.
            `PUT /onboarding/profile` takes firstName, lastName, phone and
            jobTitle and rejects anything else, so it is never sent — the
            address country is collected on the company form one screen later.
          */}
          <SelectField
            control={form.control}
            name="phoneCountry"
            label="Country"
            icon={Globe}
            required
            placeholder="Select your country"
            options={COUNTRIES}
          />

          <PhoneField
            control={form.control}
            name="phone"
            countryName="phoneCountry"
            label="Phone Number"
            icon={Phone}
            required
            autoFocus
            placeholder="Enter your phone number"
          />

          {/*
            Job title, not a second country. 1.0 locks the title (always
            "Company Owner"); the backend's profile endpoint wants it and has
            nowhere to put an address, so this is the field that replaces it.
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
