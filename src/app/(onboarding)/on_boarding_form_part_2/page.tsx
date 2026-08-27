import type { Metadata } from "next";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { api } from "@/lib/api";
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
  // naming it — and checkout is addressed by company, so it is looked up.
  const companyId = compID || String((await api.ownedCompanies())[0]?.id ?? "");

  return (
    <AuthShell
      panel={AUTH_PANELS.signup}
      step={2}
      width="wide"
    >
      <PlanPicker
        accountEmail={decodeURIComponent(email)}
        companyId={decodeURIComponent(companyId)}
      />
    </AuthShell>
  );
}
