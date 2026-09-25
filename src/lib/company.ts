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

import type { CompanyInput, CompanyRecord } from "@/lib/api";
import { countryCode } from "@/lib/countries";
import { ApiError } from "@/lib/http";
import { stripDialCode, withDialCode } from "@/lib/phone";
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
  {
    label: "Limited Liability Corporation",
    value: "LIMITED_LIABILITY_COMPANY",
  },
  { label: "S-Corp", value: "S_CORPORATION" },
  { label: "C-Corp", value: "C_CORPORATION" },
  { label: "Non-profit", value: "NON_PROFIT" },
] as const;

export const COMPANY_TYPES = COMPANY_TYPE_OPTIONS.map((t) => t.label);

/** Label -> enum. Returns OTHER for anything unrecognised rather than failing the post. */
export function companyTypeValue(label: string): string {
  return COMPANY_TYPE_OPTIONS.find((t) => t.label === label)?.value ?? "OTHER";
}

/**
 * Enum -> label, for reopening a saved company in the form.
 *
 * OTHER has one label in this list, so the round trip is exact. A value the
 * list does not know returns "" — the select then shows its placeholder and the
 * schema makes the user pick, which beats silently relabelling their company.
 */
export function companyTypeLabel(value: string): string {
  return COMPANY_TYPE_OPTIONS.find((t) => t.value === value)?.label ?? "";
}

export const REVENUE_BANDS = [
  "Less than $500K",
  "$500K – $2M",
  "$2M – $10M",
  "$10M+",
] as const;

/**
 * Which band a stored amount falls in — the inverse of `revenueFloor`, but by
 * range rather than by equality. The column is a DECIMAL the backend may hold
 * as "500000.00" or "500000.0000", and nothing stops a company's figure being
 * edited elsewhere to a real number rather than a band floor.
 */
export function revenueBand(amount: string | null | undefined): string {
  // Blank means the column was never set, which is not the same as zero — and
  // `Number("")` is 0, so it would otherwise read as the lowest band and put a
  // revenue in the form that nobody chose.
  if (!amount?.trim()) return "";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return (
    [...REVENUE_BANDS]
      .reverse()
      .find((band) => value >= Number(revenueFloor(band))) ?? REVENUE_BANDS[0]
  );
}

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
    // REQUIRED BY THE API, and the reason this form could not save at all: the
    // onboarding validator lists `enNumber` among the fields it requires, so
    // every submit without one came back 400 "Required fields are missing."
    // while every box on screen looked filled in. Note that the copy of the
    // backend kept in Portal-backend/ predates the field — it validates this
    // same body happily, which is what made the failure look impossible.
    enNumber: values.enNumber,
    companyType: companyTypeValue(values.type),
    companyEmail: values.email,
    // With its dialling code — the field is national digits beside a country
    // picker, and the country is right here on the same form.
    companyPhone: withDialCode(values.phone, values.country),
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

/**
 * A saved company back in the form's own terms — the other direction from
 * `companyInput`, and the reason a user can walk back into step 2 and find what
 * they typed instead of an empty form.
 *
 * The address may be null: a company row can exist before its address does, and
 * blanks the user can fill are better than a crash on a screen they were sent
 * to in order to fix something.
 */
export function companyValues(company: CompanyRecord): CompanyValues {
  const address = company.primaryAddress;
  return {
    name: company.companyName,
    type: companyTypeLabel(company.companyType),
    // Blank rather than a stand-in when a route does not send one back: a
    // number that is not an EN Number, shown where one goes, is worse than an
    // empty box.
    enNumber: company.enNumber ?? "",
    addressLine1: address?.addressLine1 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    zip: address?.postalCode ?? "",
    // Empty rather than a default: reopening a company must show what was
    // saved, and a country nobody chose is not that.
    country: address?.country ?? "",
    email: company.companyEmail,
    // Back to national digits for the field; the picker shows the country.
    phone: stripDialCode(company.companyPhone ?? "", address?.country ?? ""),
    employees:
      company.employeeCount === null ? "" : String(company.employeeCount),
    revenue: revenueBand(company.lastYearRevenue),
  };
}

/**
 * Which box on the form holds the field the backend is complaining about.
 *
 * The two vocabularies do not line up — the form has one `zip` where the API
 * has `postalCode`, and the API's address is a nested object whose parts come
 * back as flat keys — so a rejection cannot be routed without this. Keys are
 * every name `companyInput` can produce, plus the flat address names
 * `validateAddress` reports.
 *
 * `countryCode` is derived from the country the user picked, so it points at
 * the picker rather than at a box that does not exist. `revenueCurrency` is
 * deliberately absent: it is hard-coded to USD, so nothing on the form can fix
 * it and pinning it to a field would send the user to correct something they
 * did not choose — it stays on the form-level alert instead.
 */
const COMPANY_FIELD_OF: Record<string, keyof CompanyValues> = {
  companyName: "name",
  enNumber: "enNumber",
  companyType: "type",
  companyEmail: "email",
  companyPhone: "phone",
  employeeCount: "employees",
  lastYearRevenue: "revenue",
  address: "addressLine1",
  addressLine1: "addressLine1",
  city: "city",
  state: "state",
  postalCode: "zip",
  country: "country",
  countryCode: "country",
};

/**
 * Put a rejected request back on the fields it is about.
 *
 * Without this the backend's per-field messages are thrown away and the user
 * reads the summary line alone — "Required fields are missing." under a form
 * whose every box looks filled, naming none of them. The client schema catches
 * the blanks it can see; what reaches here is what only the server knows (a
 * postal code that is wrong for its country, a duplicate email), and it knows
 * which field it means.
 *
 * Returns the messages it could NOT place, so the caller can still say
 * something about a field this form does not render.
 */
export function applyCompanyFieldErrors(
  err: unknown,
  setError: (field: keyof CompanyValues, error: { message: string }) => void,
): string[] {
  if (!(err instanceof ApiError) || !err.fields) return [];

  const unplaced: string[] = [];
  for (const [name, message] of Object.entries(err.fields)) {
    const field = COMPANY_FIELD_OF[name];
    if (field) setError(field, { message });
    else unplaced.push(`${name}: ${message}`);
  }
  return unplaced;
}
