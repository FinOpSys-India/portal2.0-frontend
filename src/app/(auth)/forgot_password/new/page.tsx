import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";

import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "New password – FinOpSys" };

/**
 * Step three of a password reset. Reached only from the verify screen, which
 * puts the single-use `resetToken` in the query.
 */
export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // No token means the code was never verified — this screen cannot do
  // anything, so it sends people back to where one is obtained rather than
  // rendering a form whose only outcome is an error.
  if (!token) redirect("/forgot_password");

  return (
    <AuthShell panel={AUTH_PANELS.forgotPassword}>
      <NewPasswordForm resetToken={token} />
    </AuthShell>
  );
}
