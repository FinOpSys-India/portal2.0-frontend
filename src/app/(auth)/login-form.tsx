"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  AuthCard,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";
import { AuthHeading, AuthLink } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-alert";
import { Form } from "@/components/ui/form";
import { api } from "@/lib/api";
import { loginSchema, type LoginValues } from "@/lib/schemas";

export function LoginForm() {
  const router = useRouter();
  const [failure, setFailure] = React.useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    // Validate on submit, then keep correcting as they type — nagging before
    // the first attempt is the classic form annoyance.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: LoginValues) {
    setFailure(null);
    try {
      const challenge = await api.login(values.email.trim(), values.password);
      // The challenge id is what step two spends; the masked address is carried
      // alongside it only so the screen can show who the code went to.
      router.push(
        `/otp_page_login?challenge=${encodeURIComponent(challenge.challengeId)}` +
          `&email=${encodeURIComponent(challenge.maskedEmail)}`,
      );
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not sign you in.");
    }
  }

  return (
    <AuthCard>
      <AuthHeading title="Login">
        Login to access your FinOpSys account
      </AuthHeading>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <TextField
            control={form.control}
            name="email"
            label="Email Address"
            icon={Mail}
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="Enter your email address"
          />

          <PasswordField
            control={form.control}
            name="password"
            label="Password"
            icon={Lock}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />

          <div className="flex justify-end">
            <AuthLink href="/forgot_password" className="text-sm">
              Forgot password?
            </AuthLink>
          </div>

          <FormAlert>{failure}</FormAlert>

          <SubmitButton pending={form.formState.isSubmitting}>
            Login
          </SubmitButton>
        </form>
      </Form>
    </AuthCard>
  );
}
