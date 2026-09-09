/**
 * The billing boundary: everything under `/billing`, which is everything that
 * touches Stripe.
 *
 * WHO MAY CALL THESE. `/billing/plans` is the catalog and any signed-in user may
 * read it. EVERY OTHER ROUTE HERE IS OWNER-OR-ADMIN — `billingAccess.js` checks
 * `company.ownerUserId === caller.id` unless the caller is an ADMIN, and that is
 * deliberately narrower than company READ access. An accounting manager or an
 * assigned specialist can see a company's team and its projects and still get
 * `403 COMPANY_ACCESS_DENIED` here, so a manager's screens are priced from
 * `GET /accounting-manager/companies` instead (see `toPlans`), never from these.
 *
 * NO AMOUNT EVER TRAVELS TOWARDS STRIPE. The client names an option id; the
 * server resolves it to a plan code, a `service_plans` row and a Stripe price.
 * The amounts read back here are for display: at checkout they come from that
 * catalog, and afterwards from `company_subscription_items.unit_amount`, the
 * price captured at purchase — which is why a subscriber who bought at $249
 * keeps reading $249 after the list price moves.
 */

import { ApiError, get, post } from "@/lib/http";
import {
  BOOKKEEPING_TIERS,
  PAYROLL,
  TAX_TIERS,
  type BookkeepingTier,
  type PayrollPricing,
  type TaxTier,
} from "@/lib/plans";

/* --------------------------------------------------------------- catalog -- */

interface CatalogOption {
  optionId: string;
  name: string;
  unitAmountMinor: number;
  currency: string;
  billingInterval: string;
  displayOrder: number;
  quantityEnabled: boolean;
  quantityLabel?: string;
}

export interface BackendCatalog {
  currency: string;
  bookkeeping: CatalogOption[];
  taxes: CatalogOption[];
  payroll: {
    planId: string;
    components: Partial<
      Record<"base" | "employees" | "contractors", CatalogOption>
    >;
  }[];
}

export interface PlanCatalog {
  currency: string;
  bookkeeping: BookkeepingTier[];
  taxes: TaxTier[];
  payroll: PayrollPricing;
  /** False when the catalog request failed and the 1.0 prices are showing. */
  live: boolean;
}

/** The prices this app shipped with, for when the catalog cannot be read. */
const FALLBACK: PlanCatalog = {
  currency: "USD",
  bookkeeping: BOOKKEEPING_TIERS,
  taxes: TAX_TIERS,
  payroll: PAYROLL,
  live: false,
};

/**
 * SERVER-DRIVEN, LOCALLY WORDED.
 *
 * The catalog decides WHICH options are sellable and at WHAT price — an option
 * the server did not send is not for sale and must not be rendered, whatever
 * this app used to charge for it. The local table supplies only what the catalog
 * has no column for: the tier id the picker keys its selection on, and the
 * sentence under the name. An option the server sells and this app has never
 * heard of still renders, keyed by its option id and unworded, because a plan
 * nobody can buy is worse than a plan with no subtitle.
 */
function mergeTiers(options: CatalogOption[]): BookkeepingTier[] {
  return options.map((o) => {
    const local = BOOKKEEPING_TIERS.find((t) => t.optionId === o.optionId);
    return {
      id: local?.id ?? o.optionId,
      optionId: o.optionId,
      name: o.name,
      detail: local?.detail ?? "",
      priceMinor: o.unitAmountMinor,
    };
  });
}

function mergeTaxTiers(options: CatalogOption[]): TaxTier[] {
  return options.map((o) => {
    const local = TAX_TIERS.find((t) => t.optionId === o.optionId);
    return {
      id: local?.id ?? o.optionId,
      optionId: o.optionId,
      name: o.name,
      priceMinor: o.unitAmountMinor,
      // Not a sellable line anywhere in the backend catalog — 1.0 prints it as
      // copy under the tier, so it stays copy. Zero renders as no line at all.
      additionalStateMinor: local?.additionalStateMinor ?? 0,
    };
  });
}

function mergePayroll(catalog: BackendCatalog): PayrollPricing {
  // One plan, three components. `payroll_standard` is the only entry the
  // backend catalog defines; the first is taken rather than assuming the name.
  const plan = catalog.payroll[0];
  if (!plan) return PAYROLL;

  const { base, employees, contractors } = plan.components;
  return {
    planId: plan.planId,
    baseMinor: base?.unitAmountMinor ?? 0,
    perEmployeeMinor: employees?.unitAmountMinor ?? 0,
    perContractorMinor: contractors?.unitAmountMinor ?? 0,
  };
}

/**
 * The response, merged into what the picker renders. Pure, so the merge is
 * testable without a server — which matters, because a wrong field name here
 * silently prices a plan at zero rather than failing.
 */
export function toCatalog(data: BackendCatalog): PlanCatalog {
  const bookkeeping = mergeTiers(data.bookkeeping ?? []);
  const taxes = mergeTaxTiers(data.taxes ?? []);

  // An empty catalog is a deployment with no seeded `service_plans` rows, not a
  // company with nothing to buy. Rendering "no plans available" on the signup
  // path would be indistinguishable from the product being closed.
  if (!bookkeeping.length && !taxes.length) return FALLBACK;

  return {
    currency: data.currency || "USD",
    bookkeeping,
    taxes,
    payroll: mergePayroll(data),
    live: true,
  };
}

/**
 * The sellable catalog, priced by the backend.
 *
 * Swallowed, not awaited hard. This is the plan step of onboarding: a failed
 * catalog read must not replace the screen where money is committed with an
 * error page, and the option ids the picker posts are the same either way —
 * checkout re-prices every one of them server-side before Stripe is called, so
 * the worst a stale fallback can do is quote a number the receipt corrects.
 */
export async function planCatalog(): Promise<PlanCatalog> {
  try {
    return toCatalog(await get<BackendCatalog>("/billing/plans"));
  } catch {
    return FALLBACK;
  }
}

/* ---------------------------------------------------------- subscription -- */

export interface SubscriptionLine {
  /** "bookkeeping" | "payroll" | "taxes", or null for a plan we cannot name. */
  service: string | null;
  /** "plan" for a whole service; "base" / "employees" / "contractors" on payroll. */
  component: string;
  planName: string | null;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  currency: string;
}

export interface Subscription {
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  currency: string;
  recurringTotalAmountMinor: number;
  lines: SubscriptionLine[];
}

interface SubscriptionResponse {
  hasSubscription: boolean;
  subscription: Subscription | null;
}

/**
 * What this company is paying for, as one of three answers the screen renders
 * differently — because they are three different facts, not one empty state.
 *
 *   active     a live subscription, with its lines and its renewal date
 *   none       onboarded, never checked out. A NORMAL state, which is why the
 *              backend answers 200 `hasSubscription: false` rather than a 404
 *   forbidden  the reader is not the owner. Billing access is owner-or-admin
 *              (`billingAccess.js`), while everything else in this portal is
 *              open to the whole company, so an invited teammate reaches this
 *              page legitimately and must be told why it is blank
 *
 * The 403 is caught HERE and nowhere else: `getOrNull` deliberately refuses to
 * swallow one, on the grounds that "you may not see this" rendered as "this does
 * not exist" hides permission bugs. That reasoning holds — so this does not hide
 * it either, it names it.
 */
export type BillingView =
  | { state: "active"; subscription: Subscription }
  | { state: "none" }
  | { state: "forbidden" };

export async function subscription(companyId: string): Promise<BillingView> {
  try {
    const data = await get<SubscriptionResponse>(
      `/billing/subscription?companyId=${encodeURIComponent(companyId)}`,
    );
    return data.subscription
      ? { state: "active", subscription: data.subscription }
      : { state: "none" };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) return { state: "forbidden" };
    throw err;
  }
}

/**
 * A short-lived link into Stripe's hosted billing portal — card changes,
 * invoices, receipts.
 *
 * The card never touches this app, which is the point: PCI scope stays with
 * Stripe. The URL is single-use and expires, so it is minted per click rather
 * than rendered into the page.
 */
export async function portalSession(companyId: string): Promise<string> {
  const data = await post<{ portalUrl: string }>("/billing/portal", {
    companyId: Number(companyId),
  });
  return data.portalUrl;
}
