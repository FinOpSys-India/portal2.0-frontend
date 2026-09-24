"use client";

import {
  Building2,
  FileDigit,
  Globe,
  Hash,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import type { Control } from "react-hook-form";

import {
  PhoneField,
  SelectField,
  TextField,
} from "@/components/auth/fields";
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

      {/* Under Company Type, not with Employees: this is the company's legal
          identity, not a figure about its size. Optional — nothing stores it
          yet, so the four detail pages that already render `enNumber` stay
          blank until the API grows the column. */}
      <TextField
        control={control}
        name="enNumber"
        label="EN Number"
        icon={FileDigit}
        inputMode="numeric"
        numeric
        maxLength={9}
        placeholder="123456789"
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

      {/* Dialling code and digit count both follow the country chosen above. */}
      <PhoneField
        control={control}
        name="phone"
        countryName="country"
        label="Company Phone"
        icon={Phone}
        required
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
