/**
 * API boundary for auth and onboarding.
 *
 * Rewritten against the real backend. The shapes here were previously guesses
 * made before the Node service existed, and almost none of them survived
 * contact with it — the differences are structural, not cosmetic:
 *
 *   - LOGIN IS TWO STEPS AND CARRIES A CHALLENGE, NOT A USER. `POST /auth/login`
 *     answers 202 with a `challengeId` (a UUID) and a masked address. The old
 *     code threaded a `userId` through the OTP screen and tried to read an email
 *     out of it; there was never a user id to have.
 *
 *   - SIGN-UP TAKES AN INVITATION TOKEN AND LOGS YOU STRAIGHT IN. It wants the
 *     64-hex token from the invite email, and it returns tokens rather than an
 *     OTP challenge. There is no verify step after signing up.
 *
 *   - ONE ENDPOINT SERVES VERIFY AND RESEND, selected by `action`.
 */

import { clearAccessToken, get, post, put, storeAccessToken } from "@/lib/http";
import { PAYROLL } from "@/lib/plans";

/** Top-level role codes as the backend spells them. */
export type Role = "ADMIN" | "ACCOUNTING_MANAGER" | "SPECIALIST" | "CUSTOMER";

/** Where each role lands after a verified OTP. Routes match Portal 1.0. */
const LANDING: Record<Role, string> = {
  ADMIN: "/list_of_customers",
  CUSTOMER: "/comany_select",
  // NOT /comany_select — that picker lists GET /companies/owned, and a manager
  // owns nothing. Their companies are the ones they are ASSIGNED to
  // (/accounting-manager/companies), which is what the /manager portal loads.
  // Sent to the customer picker, an AM lands on an empty chooser with no way
  // forward. /manager redirects on to /manager/projects.
  ACCOUNTING_MANAGER: "/manager",
  SPECIALIST: "/project",
};

export function landingPathForRole(role: Role): string {
  return LANDING[role] ?? "/comany_select";
}

/**
 * The OTP challenge opened by a login attempt.
 *
 * `maskedEmail` comes from the server already obscured ("p***a@example.com").
 * The screen shows it as-is: the client never knew the full address at this
 * point, and asking for it would hand an unauthenticated caller a way to
 * confirm which addresses exist.
 */
export interface OtpChallenge {
  challengeId: string;
  maskedEmail: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  specificRole: string | null;
}

export interface Session {
  user: User;
  role: Role;
}

export interface SignupInput {
  invitationToken: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

/** `PUT /onboarding/profile` takes exactly these four. No address, no country. */
export interface UserInfoInput {
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
}

/**
 * `GET /onboarding`'s own `onboarding` block, verbatim.
 *
 * This was `{ profileCompleted, companyCount }` — wrong on both counts, and
 * silently so. The real payload nests the flags under `onboarding` and spells
 * the first one `profileComplete` (no `d`), so both fields read `undefined`,
 * `!undefined` is true, and the wizard would have sent every user back to step
 * one forever without a single error to show for it.
 *
 * `isOwner` matters because only an owner has the company and payment steps at
 * all — a teammate is finished the moment their profile is.
 */
export interface OnboardingStatus {
  isOwner: boolean;
  profileComplete: boolean;
  companyCreated: boolean;
  /** True only when EVERY owned company has a subscription, not merely one. */
  paymentComplete: boolean;
  complete: boolean;
}

/**
 * One company the caller owns. `GET /companies/owned` is unpaginated.
 *
 * `companyId`, NOT `id`: that is what `companyDto.toOwnedCompanyOption` names
 * the column. Read as `id` it was `undefined`, so the plan step posted an empty
 * `companyId` to `POST /billing/checkout` and the order summary showed the
 * validator's "companyId must be a positive integer" — on the one screen a new
 * owner has to get through to pay.
 */
export interface OwnedCompany {
  companyId: number;
  companyName: string;
  status: string;
}

export interface CompanyInput {
  companyName: string;
  companyType: string;
  companyEmail: string;
  companyPhone: string;
  employeeCount: number;
  lastYearRevenue: string;
  revenueCurrency: string;
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    countryCode: string;
  };
}

export interface CompanyCreated {
  company: { id: number; companyName: string };
  primaryAddress: unknown;
}

/**
 * What the plan step has chosen, in the frontend's own terms. `createCheckout`
 * translates it into the backend's `selectedServices` grammar below.
 *
 * The previous shape sent `planCodes: string[]`, which the checkout validator
 * rejects twice over: `planCodes` is not a known body field (`rejectUnknown`
 * 400s before anything else runs), and plan codes are not the vocabulary —
 * option ids are. See src/lib/plans.ts.
 */
export interface CheckoutInput {
  companyId: number;
  /** `bookkeeping_option_1` … `_4`, or null when bookkeeping was not chosen. */
  bookkeepingOptionId: string | null;
  /** `tax_option_1` … `_3`, or null. */
  taxOptionId: string | null;
  payroll: { employeeCount: number; contractorCount: number } | null;
}

/**
 * The backend's body for `POST /billing/checkout`. Each service block is
 * omitted entirely when unselected rather than sent `selected: false` — both
 * are accepted, and omitting keeps the request describing only what was bought.
 */
export interface SelectedServices {
  bookkeeping?: { selected: true; priceOptionId: string };
  taxes?: { selected: true; priceOptionId: string };
  payroll?: {
    selected: true;
    planId: string;
    employeeCount: number;
    contractorCount: number;
  };
}

/**
 * Exported so the translation can be checked without issuing a request: it is
 * the one part of `createCheckout` that can silently produce a 400, and a test
 * that had to reach the backend to see it would never run.
 */
export function toSelectedServices(input: CheckoutInput): SelectedServices {
  const selected: SelectedServices = {};

  if (input.bookkeepingOptionId) {
    selected.bookkeeping = {
      selected: true,
      priceOptionId: input.bookkeepingOptionId,
    };
  }
  if (input.taxOptionId) {
    selected.taxes = { selected: true, priceOptionId: input.taxOptionId };
  }
  if (input.payroll) {
    selected.payroll = {
      selected: true,
      planId: PAYROLL.planId,
      ...input.payroll,
    };
  }

  return selected;
}

export interface Checkout {
  checkoutUrl: string;
  sessionId: string;
}

export const api = {
  /** Step one: password check. Answers 202 with a challenge, not a session. */
  login(email: string, password: string): Promise<OtpChallenge> {
    return post("/auth/login", { email, password });
  },

  /**
   * Complete an invitation. Returns a live session — there is no OTP step on
   * this path, so the caller goes straight to the landing route.
   */
  async signup(input: SignupInput): Promise<Session> {
    const data = await post<{ tokens: { accessToken: string; expiresInSeconds: number } }>(
      "/auth/signup",
      input,
    );
    storeAccessToken(data.tokens.accessToken, data.tokens.expiresInSeconds);

    /*
     * The role comes from `me()`, not from the sign-up response.
     *
     * `POST /auth/signup` selects `USER_PUBLIC_FIELDS`, which carries `roleId`
     * and no joined `role.code` — so `user.role` was `undefined`, every session
     * failed the `role !== "CUSTOMER"` test in `landingPathFor`, and
     * `landingPathForRole(undefined)` fell through to its `/comany_select`
     * default. A brand-new customer skipped onboarding entirely and landed on a
     * workspace picker with nothing in it. `POST /auth/otp` returns the code, so
     * only this path was ever wrong, which is why login looked fine.
     */
    const user = await api.me();
    return { user, role: user.role };
  },

  /** Step two: verify the code and take the session it returns. */
  async verifyOtp(challengeId: string, otp: string): Promise<Session> {
    const data = await post<{
      user: User;
      accessToken: string;
      expiresInSeconds: number;
    }>("/auth/otp", { action: "verify", challengeId, otp });
    storeAccessToken(data.accessToken, data.expiresInSeconds);
    return { user: data.user, role: data.user.role };
  },

  /** Same endpoint, other action. Subject to the server's own cooldown. */
  resendOtp(challengeId: string): Promise<{ resendAvailableInSeconds: number }> {
    return post("/auth/otp", { action: "resend", challengeId });
  },

  /**
   * End the session — on the SERVER, not just in this tab.
   *
   * `POST /auth/logout` revokes the whole refresh-token family, which is the
   * part that matters: clearing the access cookie alone leaves a 30-day refresh
   * token alive in an HttpOnly cookie this code cannot touch, so the next call
   * to `/auth/refresh` would hand back a working session. "Logged out" would
   * have meant "logged out until something refreshes".
   *
   * The local cookie is cleared even when the request fails. A user who clicks
   * Logout must end up logged out of this browser whatever the network did; a
   * revocation that did not happen is recoverable, a Logout button that appears
   * to do nothing is not.
   */
  async logout(): Promise<void> {
    // CSRF header is attached by `request()` — this route is cookie
    // authenticated, so the backend requires it.
    await post("/auth/logout").catch(() => {});
    clearAccessToken();
  },

  /** Opens a reset challenge. Always succeeds — a 404 here enumerates accounts. */
  requestPasswordReset(email: string): Promise<{ challengeId: string }> {
    return post("/auth/password-reset", { email });
  },

  /**
   * `action` is REQUIRED, exactly as on `/auth/otp` — this endpoint serves
   * verify and resend from one route and `validatePasswordResetOtp` refuses a
   * body without it. Omitting it was a 400 (`action must be either "verify" or
   * "resend"`), which nothing caught because no screen calls this yet.
   */
  verifyPasswordResetOtp(challengeId: string, otp: string): Promise<{ resetToken: string }> {
    return post("/auth/password-reset/otp", {
      action: "verify",
      challengeId,
      otp,
    });
  },

  /** Same endpoint, other action — matching `resendOtp` on the login flow. */
  resendPasswordResetOtp(
    challengeId: string,
  ): Promise<{ resendAvailableInSeconds: number }> {
    return post("/auth/password-reset/otp", { action: "resend", challengeId });
  },

  confirmPasswordReset(resetToken: string, password: string): Promise<void> {
    return post("/auth/password-reset/confirm", { resetToken, password });
  },

  /**
   * Where the onboarding wizard resumes from.
   *
   * The response also carries a `user` block and, on the provisioning path, a
   * fresh `tokens` pair. Only the flags are returned here — a caller that wants
   * the person has `me()`, and handing back two ways to read the same user is
   * how the two drift apart.
   */
  async onboardingStatus(): Promise<OnboardingStatus> {
    const data = await get<{ onboarding: OnboardingStatus }>("/onboarding");
    return data.onboarding;
  },

  /**
   * The caller's own companies. Needed by the plan step, which is reached with
   * a `compID` in the URL on the happy path but not when a half-finished
   * account resumes into it — `GET /onboarding` reports THAT a company exists,
   * never which one.
   */
  async ownedCompanies(): Promise<OwnedCompany[]> {
    const data = await get<{ companies: OwnedCompany[] }>("/companies/owned");
    return data.companies;
  },

  /** The caller's own profile, used to prefill the locked fields on step 1. */
  me(): Promise<User> {
    return get("/users/me");
  },

  saveUserInfo(input: UserInfoInput): Promise<void> {
    return put("/onboarding/profile", input);
  },

  /**
   * Onboarding step 2. The idempotency key makes a double-submit — or a retry
   * after a dropped response — replay the first result instead of creating a
   * second company.
   */
  createCompany(input: CompanyInput, idempotencyKey: string): Promise<CompanyCreated> {
    // HEADER, not body. `validateCompanyOnboarding` calls `rejectUnknown` on
    // the body, so the key travelling inside it 400s the request that was
    // supposed to be safe to retry — the one call that most needs to succeed.
    return post("/onboarding/company", input, {
      "Idempotency-Key": idempotencyKey,
    });
  },

  /** Step 3. Prices are looked up server-side from the option ids, never sent. */
  async createCheckout(input: CheckoutInput): Promise<Checkout> {

    const data = await post<{ checkoutUrl: string; checkoutSessionId: string }>(
      "/billing/checkout",
      {
        companyId: input.companyId,
        selectedServices: toSelectedServices(input),
      },
    );
    // `checkoutSessionId` on the way out, `?sessionId=` on the way back in.
    return { checkoutUrl: data.checkoutUrl, sessionId: data.checkoutSessionId };
  },

  /** Where Stripe returns to. Normalized to paid/processing/pending/cancelled/failed. */
  checkoutStatus(sessionId: string): Promise<{ status: string }> {
    return get(`/billing/checkout-status?sessionId=${encodeURIComponent(sessionId)}`);
  },
};

/**
 * Which screen a freshly-authenticated user belongs on.
 *
 * `landingPathForRole` alone was sending every customer straight to the
 * workspace picker, so the onboarding wizard existed but nothing ever routed
 * into it: a brand-new owner with no profile, no company and no subscription
 * landed on a chooser with nothing to choose.
 *
 * Staff roles never onboard, so they skip the round trip entirely.
 */
export async function landingPathFor(session: Session): Promise<string> {
  if (session.role !== "CUSTOMER") return landingPathForRole(session.role);

  const status = await api.onboardingStatus();
  if (status.complete) return landingPathForRole(session.role);

  if (!status.profileComplete) {
    return `/on_boarding_form_user_info/${encodeURIComponent(session.user.email)}`;
  }

  const email = encodeURIComponent(session.user.email);
  if (!status.companyCreated) return `/on_boarding_form_part_1?email=${email}`;

  // Company exists but is unpaid. The plan step is addressed by company, and
  // the status payload does not name one, so it is looked up here.
  const [company] = await api.ownedCompanies();
  return company
    ? `/on_boarding_form_part_2?email=${email}&compID=${company.companyId}`
    : `/on_boarding_form_part_1?email=${email}`;
}
