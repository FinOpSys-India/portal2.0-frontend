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

/**
 * A number as it should be STORED: the country's dialling code, then the digits.
 *
 * Every phone field in this app is a country picker beside a box of national
 * digits, and only the digits were ever sent. So the record held `8887502268`
 * with nothing to say which country it belonged to, and every screen that drew
 * it — a customer detail, a profile, a company record — showed a number nobody
 * outside that country could dial.
 *
 * `+91 8887502268` is one string the API already accepts (`common.phone` takes
 * an optional leading `+` and 7 to 15 digits) and one string every reader can
 * use.
 *
 * IDEMPOTENT. A value that already carries a `+` is returned untouched, so a
 * record being re-saved after an edit does not collect a second code.
 *
 * The code is dropped when the country resolves to nothing — an unknown country
 * is not a reason to refuse to save a number the user typed.
 */
export function withDialCode(phone: string, country: string): string {
  const typed = phone.trim();
  if (!typed || typed.startsWith("+")) return typed;

  const code = dialCode(country);
  return code ? `${code} ${typed}` : typed;
}

/**
 * The digits a phone FIELD should show, given what was stored.
 *
 * The inverse of `withDialCode`, and it takes the country rather than guessing
 * one: `+1` is the United States and Canada both, so a stored number cannot say
 * on its own which picker entry to select. The form already knows the country —
 * it is on the record beside the number — so the code is stripped only when it
 * is the one that country would have added.
 *
 * Anything else is returned whole. A number stored under a country the record
 * no longer names is still a number, and showing it intact beats showing it
 * mangled.
 */
export function stripDialCode(stored: string, country: string): string {
  const value = stored.trim();
  const code = dialCode(country);
  if (!code || !value.startsWith(code)) return value;

  return value.slice(code.length).trim();
}
