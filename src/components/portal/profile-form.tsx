"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Globe, MapPin, Phone } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  PhoneField,
  SelectField,
  StaticField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form } from "@/components/ui/form";
import { COUNTRIES } from "@/lib/countries";
import { saveMyProfile, type MyProfile } from "@/lib/portal";
import { profileSchema, type ProfileValues } from "@/lib/schemas";

/**
 * Profile, for whoever is signed in.
 *
 * ONE FORM FOR EVERY PORTAL. 1.0 shows the customer and the manager the same
 * two sections, and the write behind them is `PATCH /users/me` — the same row
 * the admin's screens and the manager's directory read back. A second copy of
 * this form would be a second chance for one portal to stop saving.
 *
 * Name and email come from the invite and are read-only, matching 1.0 — but
 * 1.0 has no Save button at all, so an edit to the phone or the address simply
 * vanishes. This one saves.
 *
 * The avatar is deliberately NOT in here: it is its own write, to its own
 * endpoint, and each portal draws its card in a different place. Pages compose
 * `AvatarUpload` alongside this.
 */
export function ProfileForm({
  profile,
  role,
}: {
  profile: MyProfile;
  /**
   * The job role, when the portal has one to show — the specialist's
   * speciality. Read-only for the same reason the name is: `PATCH /users/me`
   * takes phone and address and nothing else. Omitted where the role is the
   * portal itself and the card beside the form already says it.
   */
  role?: string;
}) {
  const router = useRouter();
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
      // No fallback. An unset country is a question, not a value to guess —
      // guessing one and then validating their phone against it is how a
      // nine-digit number was rejected "for United States of America" on an
      // account that had never named a country.
      country: profile.country,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: ProfileValues) {
    setFailure(null);
    setSaved(false);
    try {
      await saveMyProfile(values);
      setSaved(true);
      // The frame's account menu reads the same record, and so does every
      // other screen showing this person — refresh so the page the user is
      // looking at is not the one place still showing the old number.
      router.refresh();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-6"
      >
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">General Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <StaticField label="Full Name" value={profile.fullName} />
            <StaticField label="Email Address" value={profile.email} />
            {/*
              The country lives in the address section further down — the same
              one the phone is validated against, so changing it re-checks the
              number rather than leaving a stale dialling code above it.
            */}
            <PhoneField
              control={form.control}
              name="phone"
              countryName="country"
              label="Phone Number"
              icon={Phone}
              required
              placeholder="Enter your phone number"
            />
            {role ? <StaticField label="Job Role" value={role} /> : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">
            Full Address Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                control={form.control}
                name="addressLine1"
                label="Address Line 1"
                icon={MapPin}
                autoComplete="address-line1"
                placeholder="Street Address"
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
              placeholder="ZIP Code"
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
            Save Changes
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}
