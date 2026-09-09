/**
 * The plan copy, and the prices to fall back on.
 *
 * PRICES LIVE IN STRIPE, NOT HERE. `GET /billing/plans` publishes the sellable
 * catalog — our own option ids, the plan names, and the amounts read off the
 * `service_plans` rows that carry the Stripe price ids — and `planCatalog()` in
 * lib/billing.ts is what the picker actually renders. The numbers below are what
 * 1.0 charged, kept for two jobs a catalog response cannot do:
 *
 *   1. COPY. "Up to 50 transactions", the additional-state line, the tier ids
 *      the picker keys its selection on. None of that is in `service_plans`.
 *   2. A FALLBACK. Onboarding is where money is committed, and a blank plan step
 *      is worse than a stale one, so a catalog request that fails renders these
 *      instead of nothing. Checkout still prices server-side from the option id,
 *      so a drifted number here can misquote a customer but can never charge
 *      them the wrong amount.
 *
 * MINOR UNITS THROUGHOUT, matching every money field in the API. Dollars-as-
 * integers could not represent the $12.50 the catalog is free to return.
 */

import { money } from "@/lib/portal";

/**
 * OPTION IDS, NOT PLAN CODES.
 *
 * These used to carry `planCode: "BOOKKEEPING_STARTER"`, which is a real string
 * in the backend — it is just not the one checkout accepts. The client sends an
 * OPTION id (`bookkeeping_option_1`); `src/config/serviceCatalog.js` maps that
 * to a plan code, the plan code to a `service_plans` row, and the row to a
 * Stripe price. A plan code sent from here is rejected as an unknown option
 * before Stripe is ever called, so the whole checkout 400s.
 */
export type BookkeepingTier = {
  id: string;
  /** `selectedServices.bookkeeping.priceOptionId`. Prices stay server-side. */
  optionId: string;
  name: string;
  detail: string;
  priceMinor: number;
};

export const BOOKKEEPING_TIERS: BookkeepingTier[] = [
  { id: "starter", optionId: "bookkeeping_option_1", name: "Starter", detail: "Up to 50 transactions", priceMinor: 9900 },
  { id: "growth", optionId: "bookkeeping_option_2", name: "Growth", detail: "51–200 transactions", priceMinor: 24900 },
  { id: "scale", optionId: "bookkeeping_option_3", name: "Scale", detail: "201–500 transactions", priceMinor: 44900 },
  {
    id: "premium",
    optionId: "bookkeeping_option_4",
    name: "Premium",
    detail: "501–1,000 transactions",
    priceMinor: 79900,
  },
];

export type PayrollPricing = {
  /** `selectedServices.payroll.planId` — one plan, three priced components. */
  planId: string;
  baseMinor: number;
  perEmployeeMinor: number;
  perContractorMinor: number;
};

export const PAYROLL: PayrollPricing = {
  planId: "payroll_standard",
  baseMinor: 2900,
  perEmployeeMinor: 1500,
  perContractorMinor: 1000,
};

export type TaxTier = {
  id: string;
  optionId: string;
  name: string;
  priceMinor: number;
  /** 1.0's copy. No sellable option id behind it, so it is a label, not a line. */
  additionalStateMinor: number;
};

/**
 * Only three bands, while the company form offers four revenue ranges — a
 * company that answered "$10M+" has no matching tier. That gap is 1.0's, and
 * is left visible rather than papered over with an invented fourth price.
 */
export const TAX_TIERS: TaxTier[] = [
  { id: "under-500k", optionId: "tax_option_1", name: "Less than $500K revenue", priceMinor: 6300, additionalStateMinor: 7900 },
  { id: "500k-2m", optionId: "tax_option_2", name: "$500K – $2M revenue", priceMinor: 12500, additionalStateMinor: 12900 },
  { id: "2m-10m", optionId: "tax_option_3", name: "$2M – $10M revenue", priceMinor: 23300, additionalStateMinor: 19900 },
];

/** What a payroll line comes to, in minor units, at these counts. */
export function payrollTotal(
  employees: number,
  contractors: number,
  pricing: PayrollPricing = PAYROLL,
): number {
  return (
    pricing.baseMinor +
    employees * pricing.perEmployeeMinor +
    contractors * pricing.perContractorMinor
  );
}

/**
 * Minor units in, a price out. The same formatter the portals' plan tables use,
 * so a tier quoted at checkout and the same tier on the billing screen cannot
 * render differently.
 */
export function formatMoney(minor: number, currency = "USD"): string {
  return money(minor, currency);
}
