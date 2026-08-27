/**
 * Company option sets.
 *
 * 1.0's Bubble option values are deliberately NOT reused here:
 *
 *   - Company Type is misaligned in 1.0 — picking "S-Corp" stores
 *     `bookkeping_specialist`, "Partnership" stores
 *     `limited_liability_partnership`, and so on down the list. Only
 *     "Sole Proprietor" maps correctly. See docs/customer-onboarding.md.
 *   - Revenue keys are stale: the label "≤ $500K" stores
 *     `businesses_with_revenue_up_to__250k_year`, from an older price band.
 *
 * The Node backend is new, so these use honest values. Anything migrating
 * 1.0's rows has to remap them, which is a data problem rather than a
 * frontend one.
 */

import type { CompanyInput } from "@/lib/api";
import { countryCode } from "@/lib/countries";
import type { CompanyValues } from "@/lib/schemas";

/**
 * Label the customer picks, and the enum the backend stores.
 *
 * The two lists are not the same length and never were. `companyType` is a
 * closed enum — SOLE_PROPRIETORSHIP, PARTNERSHIP, LIMITED_LIABILITY_COMPANY,
 * C_CORPORATION, S_CORPORATION, NON_PROFIT, OTHER — and anything else is a 400,
 * so the label cannot be posted as typed.
 *
 * "Limited Liability Partnership" is the odd one: 1.0 offers it, the backend
 * has no such member, and it maps to OTHER rather than being quietly folded
 * into LIMITED_LIABILITY_COMPANY, which is a different legal form.
 */
export const COMPANY_TYPE_OPTIONS = [
  { label: "Sole Proprietor", value: "SOLE_PROPRIETORSHIP" },
  { label: "Partnership", value: "PARTNERSHIP" },
  { label: "Limited Liability Partnership", value: "OTHER" },
  { label: "Limited Liability Corporation", value: "LIMITED_LIABILITY_COMPANY" },
  { label: "S-Corp", value: "S_CORPORATION" },
  { label: "C-Corp", value: "C_CORPORATION" },
  { label: "Non-profit", value: "NON_PROFIT" },
] as const;

export const COMPANY_TYPES = COMPANY_TYPE_OPTIONS.map((t) => t.label);

/** Label -> enum. Returns OTHER for anything unrecognised rather than failing the post. */
export function companyTypeValue(label: string): string {
  return (
    COMPANY_TYPE_OPTIONS.find((t) => t.label === label)?.value ?? "OTHER"
  );
}

export const REVENUE_BANDS = [
  "Less than $500K",
  "$500K – $2M",
  "$2M – $10M",
  "$10M+",
] as const;

/** Bottom of each revenue band, as the decimal string the column stores. */
function revenueFloor(band: string): string {
  const floors: Record<string, string> = {
    "Less than $500K": "0.00",
    "$500K – $2M": "500000.00",
    "$2M – $10M": "2000000.00",
    "$10M+": "10000000.00",
  };
  return floors[band] ?? "0.00";
}

/**
 * The form's answers as the create-company endpoint wants them.
 *
 * Shared by onboarding step 2 and the portal's Add Company dialog — one place
 * that knows the label-to-enum mapping, so a company added later cannot end up
 * shaped differently from the first one.
 */
export function companyInput(values: CompanyValues): CompanyInput {
  return {
    companyName: values.name,
    companyType: companyTypeValue(values.type),
    companyEmail: values.email,
    companyPhone: values.phone,
    employeeCount: Number(values.employees),
    // Sent as a string: the column is DECIMAL(18,2) and the value must never
    // pass through a binary float on the way there.
    lastYearRevenue: revenueFloor(values.revenue),
    revenueCurrency: "USD",
    address: {
      addressLine1: values.addressLine1,
      city: values.city,
      state: values.state,
      postalCode: values.zip,
      country: values.country,
      // Required, and the backend picks its postal-code and state rules from
      // it — not decoration.
      countryCode: countryCode(values.country),
    },
  };
}
