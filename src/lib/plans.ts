/**
 * Pricing, taken verbatim from Portal 1.0's plan step.
 *
 * Money lives in whole dollars per month. Kept as integers rather than
 * formatted strings so the order total is arithmetic, not string surgery.
 */

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
  price: number;
};

export const BOOKKEEPING_TIERS: BookkeepingTier[] = [
  { id: "starter", optionId: "bookkeeping_option_1", name: "Starter", detail: "Up to 50 transactions", price: 99 },
  { id: "growth", optionId: "bookkeeping_option_2", name: "Growth", detail: "51–200 transactions", price: 249 },
  { id: "scale", optionId: "bookkeeping_option_3", name: "Scale", detail: "201–500 transactions", price: 449 },
  {
    id: "premium",
    optionId: "bookkeeping_option_4",
    name: "Premium",
    detail: "501–1,000 transactions",
    price: 799,
  },
];

export const PAYROLL = {
  base: 29,
  perEmployee: 15,
  perContractor: 10,
  /** `selectedServices.payroll.planId` — one plan, three priced components. */
  planId: "payroll_standard",
};

export type TaxTier = {
  id: string;
  optionId: string;
  name: string;
  price: number;
  additionalState: number;
};

/**
 * Only three bands, while the company form offers four revenue ranges — a
 * company that answered "$10M+" has no matching tier. That gap is 1.0's, and
 * is left visible rather than papered over with an invented fourth price.
 */
export const TAX_TIERS: TaxTier[] = [
  { id: "under-500k", optionId: "tax_option_1", name: "Less than $500K revenue", price: 63, additionalState: 79 },
  { id: "500k-2m", optionId: "tax_option_2", name: "$500K – $2M revenue", price: 125, additionalState: 129 },
  { id: "2m-10m", optionId: "tax_option_3", name: "$2M – $10M revenue", price: 233, additionalState: 199 },
];

export function payrollTotal(employees: number, contractors: number): number {
  return (
    PAYROLL.base +
    employees * PAYROLL.perEmployee +
    contractors * PAYROLL.perContractor
  );
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
