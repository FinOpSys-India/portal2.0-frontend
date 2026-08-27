"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";

import { AuthCard, SubmitButton, TextField } from "@/components/auth/fields";
import { AuthHeading, BackToLogin } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form } from "@/components/ui/form";
import { api } from "@/lib/api";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/schemas";

export function ForgotPasswordForm() {
  const [failure, setFailure] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFailure(null);
    try {
      await api.requestPasswordReset(values.email.trim());
      setSent(true);
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not send the email.",
      );
    }
  }

  return (
    <AuthCard>
      <div className="space-y-4">
        <BackToLogin />

        {/* A CODE, not a link. `sendPasswordResetOtpEmail` takes an `otp` and
            builds no URL — promising a link sends people hunting for one that
            was never in the message. */}
        <AuthHeading title="Forgot your password?">
          Happens to all of us. Enter your email and we&rsquo;ll send a
          verification code.
        </AuthHeading>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
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

          {/* Deliberately does not confirm whether the address exists. */}
          {sent ? (
            <Alert className="items-start">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              <AlertDescription>
                If that address has an account, a recovery email is on its way.
              </AlertDescription>
            </Alert>
          ) : null}

          <FormAlert>{failure}</FormAlert>

          <SubmitButton pending={form.formState.isSubmitting}>
            Send verification code
          </SubmitButton>
        </form>
      </Form>
    </AuthCard>
  );
}
