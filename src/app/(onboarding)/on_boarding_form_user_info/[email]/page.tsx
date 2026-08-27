import type { Metadata } from "next";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { api } from "@/lib/api";
import { UserInfoForm } from "./user-info-form";

export const metadata: Metadata = {
  title: "Your details – FinOpSys",
};

/**
 * Onboarding step 1.
 *
 * 1.0 routes here as `/on_boarding_form_user_info/<email>?email=<email>` — the
 * same address twice, once as a path segment and once as a query param. Both
 * are still accepted so existing links keep working, but neither is used to
 * FETCH anything any more.
 *
 * The person is read from `GET /users/me` instead, which resolves the caller
 * from their own access token. Looking a user up by an address out of the URL
 * would let anyone read anyone's details by editing it.
 */
export default async function UserInfoPage({
  params,
  searchParams,
}: {
  params: Promise<{ email: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const [{ email: fromPath }, { email: fromQuery }] = await Promise.all([
    params,
    searchParams,
  ]);

  const me = await api.me();
  const email = decodeURIComponent(fromPath || fromQuery || "") || me.email;

  return (
    <AuthShell panel={AUTH_PANELS.signup} step={0}>
      <UserInfoForm email={email} me={me} />
    </AuthShell>
  );
}
