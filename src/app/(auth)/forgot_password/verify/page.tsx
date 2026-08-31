import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = { title: "Verify code – FinOpSys" };

/**
 * Step two of a password reset, and it did not exist.
 *
 * `POST /auth/password-reset` has always answered with a `challengeId` and
 * emailed a code; the frontend showed "a recovery email is on its way" and
 * stopped there. `api.verifyPasswordResetOtp` and `api.confirmPasswordReset`
 * were written and had ZERO callers — a user who forgot their password received
 * a code with nowhere to type it, so the flow could not be completed at all.
 *
 * `?challenge=` is the only thing that can be spent here. No address is carried:
 * unlike login, `POST /auth/password-reset` deliberately answers the same way
 * whether or not the account exists, so there is no masked address to show and
 * inventing one would confirm which addresses are real.
 */
export default async function PasswordResetOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { challenge } = await searchParams;

  // Reached without one — a bookmark, or a refresh after the flow restarted.
  // Back to the start rather than a screen whose Verify can only fail.
  if (!challenge) redirect("/forgot_password");

  return (
    // The recovery panel, not the generic OTP one — this is still the same
    // errand the previous screen started.
    <AuthShell panel={AUTH_PANELS.forgotPassword}>
      <OtpForm challengeId={challenge} email="" purpose="reset" showBackToLogin />
    </AuthShell>
  );
}
