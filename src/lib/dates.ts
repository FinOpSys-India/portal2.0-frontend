/**
 * Date helpers shared by the forms. Pure, and free of any import that would
 * drag the API layer into a client bundle.
 */

/**
 * The first day a deadline may be set to, as the `yyyy-mm-dd` a date input
 * wants for `min`.
 *
 * TOMORROW, NOT TODAY, which is 1.0's rule: a deadline is something to work
 * towards, and one that expires the same evening is a data-entry mistake more
 * often than an intention.
 *
 * Built from the LOCAL date rather than `toISOString()` on a raw `new Date()`.
 * That call converts to UTC first, so for anyone east of Greenwich late in the
 * day it returns the day after tomorrow, and for anyone west of it in the
 * morning it returns today — the very day this is meant to exclude. Reading the
 * local parts and formatting them by hand is what keeps "tomorrow" the reader's
 * tomorrow.
 */
export function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
