"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Globe, MapPin, Phone } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  SelectField,
  StaticField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form } from "@/components/ui/form";
import { COUNTRIES } from "@/lib/countries";
import { customerApi, type Profile } from "@/lib/customer";
import { profileSchema, type ProfileValues } from "@/lib/schemas";

/**
 * Profile. Name and email come from the invite and are read-only, matching
 * 1.0 — but 1.0 has no Save button at all, so edits to the address simply
 * vanish. This one saves.
 */
export function ProfileForm({ profile }: { profile: Profile }) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: profile.phone,
      addressLine1: profile.addressLine1,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
      country: profile.country || COUNTRIES[0],
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: ProfileValues) {
    setFailure(null);
    setSaved(false);
    try {
      await customerApi.saveProfile({ ...profile, ...values });
      setSaved(true);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
        <InitialsAvatar name={profile.fullName} className="size-14 text-base" />
        <div>
          <p className="font-semibold">{profile.fullName}</p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </section>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-6"
        >
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold">General information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StaticField label="Full Name" value={profile.fullName} />
              <StaticField label="Email Address" value={profile.email} />
              <TextField
                control={form.control}
                name="phone"
                label="Phone Number"
                icon={Phone}
                required
                type="tel"
                inputMode="numeric"
                numeric
                maxLength={15}
                placeholder="Enter your phone number"
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold">Address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  control={form.control}
                  name="addressLine1"
                  label="Address Line 1"
                  icon={MapPin}
                  autoComplete="address-line1"
                  placeholder="Street address"
                />
              </div>
              <TextField
                control={form.control}
                name="city"
                label="City"
                autoComplete="address-level2"
                placeholder="City"
              />
              <TextField
                control={form.control}
                name="state"
                label="State"
                autoComplete="address-level1"
                placeholder="State"
              />
              <TextField
                control={form.control}
                name="zip"
                label="ZIP Code"
                autoComplete="postal-code"
                placeholder="ZIP code"
              />
              <SelectField
                control={form.control}
                name="country"
                label="Country"
                icon={Globe}
                required
                placeholder="Select your country"
                options={COUNTRIES}
              />
            </div>
          </section>

          {saved ? (
            <Alert className="items-start">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              <AlertDescription>Your details are saved.</AlertDescription>
            </Alert>
          ) : null}

          <FormAlert>{failure}</FormAlert>

          <div className="max-w-xs">
            <SubmitButton pending={form.formState.isSubmitting}>
              Save changes
            </SubmitButton>
          </div>
        </form>
      </Form>
    </div>
  );
}
