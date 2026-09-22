import { getCountryCallingCode, isSupportedCountry, type CountryCode } from "libphonenumber-js";

import { countryCode } from "@/lib/countries";

/**
 * The dialling code beside a phone field, and nothing else.
 *
 * THIS FILE USED TO VALIDATE THE NUMBER TOO — per-country digit counts from
 * libphonenumber's length tables, plus a matching cap on the input. It was
 * removed deliberately: the counts were right (US 10, India 8-13) but the
 * COUNTRY they were checked against was not, because every form opens on the
 * default and most people never touch the picker. The result was a field that
 * rejected correct numbers and accepted wrong ones with equal confidence.
 *
 * The number is now whatever the user types. The backend still holds the outer
 * bound — `common.phone` wants 7 to 15 digits and stores the value verbatim —
 * and that is the only length rule left anywhere.
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
