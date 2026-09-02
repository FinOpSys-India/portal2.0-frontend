import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { api, landingPathForRole } from "@/lib/api";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = {
  title: "Your company – FinOpSys",
};

/** Onboarding step 2. 1.0 routes here as `?email=<accountEmail>`. */
export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;

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
  const status = await api.onboardingStatus();
  if (!status.isOwner) redirect(landingPathForRole("CUSTOMER"));

  return (
    <AuthShell
      panel={AUTH_PANELS.signup}
      step={1}
    >
      <CompanyForm accountEmail={decodeURIComponent(email)} />
    </AuthShell>
  );
}
