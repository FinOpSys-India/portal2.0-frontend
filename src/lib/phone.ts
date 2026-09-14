import {
  getCountryCallingCode,
  isSupportedCountry,
  isValidPhoneNumber,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";

import { countryCode } from "@/lib/countries";

/**
 * Phone rules, derived from whichever country the form has selected.
 *
 * The digit count a number needs is per-country and changes when a country
 * changes its numbering plan, so it is metadata, not a regex: libphonenumber's
 * "min" bundle is the length tables and nothing else, which is all this needs.
 * The "max" bundle also checks digit *patterns* — a bigger download to reject
 * numbers whose prefix is unallocated, which is not what was asked for and
 * would reject a number the day a carrier gets a new range.
 *
 * ponytail: length-only, so a right-length number with a bogus prefix passes.
 * Swap both imports to `libphonenumber-js/max` (+72KB) if that starts costing
 * real support time.
 */

/**
 * `COUNTRY_CODES` is the backend's list, not ISO-3166: it still uses six codes
 * withdrawn from the standard and "UK" rather than "GB". Those values have to
 * keep round-tripping to the API exactly as they are, so the correction lives
 * here instead of in the list itself.
 */
const ISO_FIXUPS: Record<string, CountryCode> = {
  DY: "BJ", // Benin
  HV: "BF", // Burkina Faso
  FX: "FR", // Metropolitan France
  SU: "RU", // Russia
  TP: "TL", // Timor-Leste
  UK: "GB", // United Kingdom
  YU: "RS", // Serbia
};

/** The region libphonenumber knows a country by, or undefined if it has none. */
export function phoneRegion(country: string): CountryCode | undefined {
  const code = countryCode(country);
  const iso = ISO_FIXUPS[code] ?? (code as CountryCode);
  return isSupportedCountry(iso) ? iso : undefined;
}

/** "+91" for India, "+1" for the US. "" when the country has no plan listed. */
export function dialCode(country: string): string {
  const region = phoneRegion(country);
  return region ? `+${getCountryCallingCode(region)}` : "";
}

/**
 * What is wrong with this national number for this country, or undefined.
 *
 * The value is national digits — the dialling code is shown beside the input
 * rather than typed into it, and is not part of what gets stored.
 */
export function phoneIssue(
  phone: string,
  country: string,
): string | undefined {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "Enter your phone number.";

  const region = phoneRegion(country);
  // An unlisted country falls back to the old loose floor: a country we cannot
  // check must not become a country you cannot enter a real number for.
  if (!region) {
    return digits.length >= 7 ? undefined : "Enter a valid phone number.";
  }

  if (isValidPhoneNumber(digits, region)) return undefined;

  // `isValidPhoneNumber` is the verdict; this only words it. It is the wider
  // check of the two — India allows 8 to 11 digits across all its plans, so a
  // nine-digit number is not "too short", it is just not a number.
  switch (validatePhoneNumberLength(digits, region)) {
    case "TOO_SHORT":
      return `Too few digits for ${country} (${dialCode(country)}).`;
    case "TOO_LONG":
      return `Too many digits for ${country} (${dialCode(country)}).`;
    default:
      return `Enter a valid phone number for ${country} (${dialCode(country)}).`;
  }
}
