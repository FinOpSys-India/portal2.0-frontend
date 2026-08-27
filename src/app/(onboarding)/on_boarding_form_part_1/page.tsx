import type { Metadata } from "next";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
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

  return (
    <AuthShell
      panel={AUTH_PANELS.signup}
      step={1}
    >
      <CompanyForm accountEmail={decodeURIComponent(email)} />
    </AuthShell>
  );
}
