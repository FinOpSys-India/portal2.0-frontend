import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { api, landingPathForRole, unpaidCompany } from "@/lib/api";
import { companyValues } from "@/lib/company";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = {
  title: "Your company – FinOpSys",
};

/** Onboarding step 2. 1.0 routes here as `?email=<accountEmail>`. */
export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; compID?: string }>;
}) {
  const { email = "", compID = "" } = await searchParams;

  /*
   * ONLY AN OWNER HAS THIS STEP. Sign-up is invitation-only, so a teammate
   * arrives already holding CUSTOMER/TEAM and belonging to the company that
   * invited them — there is nothing here for them to create, and
   * `POST /onboarding/company` is gated on the owner role. Without this guard
   * the profile step sent every invitee here regardless, and the flow ended on
   * a filled-in form answering "You do not have permission to perform this
   * action." Guarded on the page rather than at the one push that led here, so
   * every route into it — a resumed session, a back button, a pasted link —
   * gets the same answer.
   */
  const [status, me] = await Promise.all([api.onboardingStatus(), api.me()]);
  if (!status.isOwner) redirect(landingPathForRole("CUSTOMER"));

  // The address is what the duplicate-email rule compares against, so falling
  // back to `me` matters: reached without the query param the rule had nothing
  // to compare and quietly passed anything.
  const accountEmail = decodeURIComponent(email) || me.email;

  /*
   * WHICH COMPANY THIS SCREEN IS ABOUT, if any.
   *
   * Arriving from the plan step's Back carries `compID`. Arriving from step 1
   * after going back to correct it does not — but the company was already
   * created on the way through, and a blank form here would create a SECOND
   * one. `GET /onboarding` says only THAT a company exists, so the unpaid one
   * is looked up the same way the plan step looks it up.
   */
  const companyId =
    compID ||
    (status.companyCreated
      ? String(unpaidCompany(await api.ownedCompanies())?.companyId ?? "")
      : "");
  const existing = companyId ? await api.company(companyId) : null;

  return (
    <AuthShell panel={AUTH_PANELS.signup} step={1}>
      <CompanyForm
        accountEmail={accountEmail}
        companyId={companyId}
        initial={existing ? companyValues(existing) : undefined}
      />
    </AuthShell>
  );
}
