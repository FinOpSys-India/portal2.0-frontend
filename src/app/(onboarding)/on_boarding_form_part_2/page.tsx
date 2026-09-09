import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { api, unpaidCompany } from "@/lib/api";
import { PlanPicker } from "./plan-picker";

export const metadata: Metadata = {
  title: "Your plan – FinOpSys",
};

/**
 * Onboarding step 3.
 *
 * 1.0 routes here as `?email=<accountEmail>&compID=<companyEmail>`, then hands
 * off to Stripe Checkout. Payment is hosted, so the frontend's job ends at the
 * redirect and resumes on the return.
 */
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; compID?: string }>;
}) {
  const { email = "", compID = "" } = await searchParams;

  // Arriving from the company step carries `compID`. Arriving from a resumed
  // session does not — `GET /onboarding` reports that a company exists without
  // naming it — and checkout is addressed by company, so it is looked up. The
  // UNPAID one: this screen bills a company, and the first one alphabetically
  // is as likely as not one that is already live. See `unpaidCompany`.
  const companyId =
    compID ||
    String(unpaidCompany(await api.ownedCompanies())?.companyId ?? "");

  // No company to bill. Rendering the picker anyway means the plan is chosen,
  // Get started is pressed, and the FIRST thing the user is told is a
  // validator's complaint about an id they never saw. Send them to the step
  // that creates the company instead.
  if (!companyId) redirect("/on_boarding_form_part_1");

  return (
    <AuthShell panel={AUTH_PANELS.signup} step={2} width="wide">
      <PlanPicker
        accountEmail={decodeURIComponent(email)}
        companyId={decodeURIComponent(companyId)}
      />
    </AuthShell>
  );
}
