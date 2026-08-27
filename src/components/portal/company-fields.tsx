"use client";

import {
  Building2,
  Globe,
  Hash,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import type { Control } from "react-hook-form";

import { SelectField, TextField } from "@/components/auth/fields";
import { COMPANY_TYPES, REVENUE_BANDS } from "@/lib/company";
import { COUNTRIES } from "@/lib/countries";
import type { CompanyValues } from "@/lib/schemas";

/**
 * Everything a company record needs, in 1.0's order.
 *
 * Shared by onboarding step 2 and the portal's Add Company dialog: it is the
 * same record either way, so the two must not drift into asking different
 * questions or validating them differently.
 */
export function CompanyFields({
  control,
  autoFocus,
}: {
  control: Control<CompanyValues>;
  autoFocus?: boolean;
}) {
  return (
    <>
      <TextField
        control={control}
        name="name"
        label="Company Name"
        icon={Building2}
        required
        autoFocus={autoFocus}
        placeholder="Enter your company name"
      />

      <SelectField
        control={control}
        name="type"
        label="Company Type"
        icon={Landmark}
        required
        placeholder="Select company type"
        options={COMPANY_TYPES}
      />

      <TextField
        control={control}
        name="addressLine1"
        label="Address Line 1"
        icon={MapPin}
        required
        autoComplete="address-line1"
        placeholder="Enter your address"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="city"
          label="City"
          required
          autoComplete="address-level2"
          placeholder="Enter your city"
        />
        <TextField
          control={control}
          name="state"
          label="State"
          required
          autoComplete="address-level1"
          placeholder="Enter your state"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="zip"
          label="ZIP Code"
          required
          autoComplete="postal-code"
          placeholder="Enter your ZIP code"
        />
        <SelectField
          control={control}
          name="country"
          label="Country"
          icon={Globe}
          required
          placeholder="Select your country"
          options={COUNTRIES}
        />
      </div>

      <TextField
        control={control}
        name="email"
        label="Company Email"
        icon={Mail}
        required
        type="email"
        inputMode="email"
        placeholder="billing@yourcompany.com"
      />

      <TextField
        control={control}
        name="phone"
        label="Company Phone"
        icon={Phone}
        required
        type="tel"
        inputMode="numeric"
        numeric
        maxLength={15}
        placeholder="Enter your phone number"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="employees"
          label="Employees"
          icon={Users}
          required
          inputMode="numeric"
          numeric
          maxLength={6}
          placeholder="0"
        />
        <SelectField
          control={control}
          name="revenue"
          label="Last Year's Revenue"
          icon={Hash}
          required
          placeholder="Select a range"
          options={REVENUE_BANDS}
        />
      </div>
    </>
  );
}
