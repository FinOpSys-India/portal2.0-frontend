import type { Metadata } from "next";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = {
  title: "Verify code – FinOpSys",
};

/**
 * ORPHANED BY THE REAL BACKEND, and kept rather than deleted because that is a
 * product call, not a wiring one.
 *
 * 1.0 verified a code after sign-up. `POST /auth/signup` does not: it completes
 * an invitation whose token was already emailed to that address, which is the
 * same proof of control an OTP would establish, and it answers with live tokens.
 * So the signup form now lands on the portal and nothing routes here.
 *
 * It still works if reached with a `challenge` — the verify endpoint does not
 * care which flow opened the challenge — so a later decision to add a step has
 * somewhere to point.
 */
export default async function SignupOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; email?: string }>;
}) {
  const { challenge = "", email = "" } = await searchParams;

  return (
    <AuthShell panel={AUTH_PANELS.otp}>
      <OtpForm challengeId={challenge} email={email} />
    </AuthShell>
  );
}
