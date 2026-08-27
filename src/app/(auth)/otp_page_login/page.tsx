import type { Metadata } from "next";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = {
  title: "Verify code – FinOpSys",
};

/**
 * Step two of login.
 *
 * `challenge` is the UUID `POST /auth/login` handed back and the only thing
 * that can be spent here. `email` is the SERVER-masked address, carried purely
 * so the screen can say where the code went — it is never sent back.
 */
export default async function LoginOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; email?: string }>;
}) {
  const { challenge = "", email = "" } = await searchParams;

  return (
    <AuthShell panel={AUTH_PANELS.otp}>
      <OtpForm challengeId={challenge} email={email} showBackToLogin />
    </AuthShell>
  );
}
