import type { Metadata } from "next";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Password reset – FinOpSys",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell panel={AUTH_PANELS.forgotPassword}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
