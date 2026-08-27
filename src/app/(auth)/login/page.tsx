import type { Metadata } from "next";

import { AUTH_PANELS, AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "../login-form";

export const metadata: Metadata = {
  title: "Login – FinOpSys",
};

export default function LoginPage() {
  return (
    <AuthShell panel={AUTH_PANELS.login}>
      <LoginForm />
    </AuthShell>
  );
}
