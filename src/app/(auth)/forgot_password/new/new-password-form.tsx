"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { AuthCard, PasswordField, SubmitButton } from "@/components/auth/fields";
import { AuthHeading, BackToLogin } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form } from "@/components/ui/form";
import { api } from "@/lib/api";
import { newPasswordSchema, type NewPasswordValues } from "@/lib/schemas";

/**
 * The last step of a password reset: spend the token, set the password.
 *
 * NO AUTOMATIC SIGN-IN AFTERWARDS. `POST /auth/password-reset/confirm` answers
 * with a bare success and no tokens — it revokes the account's sessions rather
 * than opening one, which is the correct behaviour when the reason for a reset
 * may be that somebody else had the old password. So this lands on the login
 * screen, and says why before it does.
 */
export function NewPasswordForm({ resetToken }: { resetToken: string }) {
  const router = useRouter();
  const [failure, setFailure] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function onSubmit(values: NewPasswordValues) {
    setFailure(null);
    try {
      await api.confirmPasswordReset(resetToken, values.password);
      setDone(true);
      // Long enough to read the confirmation, short enough not to strand
      // anyone on a screen with nothing left to do.
      setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      setFailure(
        err instanceof Error
          ? err.message
          : "Could not set your password. Start again.",
      );
    }
  }

  return (
    <AuthCard>
      <div className="space-y-4">
        <BackToLogin />

        <AuthHeading title="Set a new password">
          Pick something you have not used here before.
        </AuthHeading>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <PasswordField
            control={form.control}
            name="password"
            label="New Password"
            required
            autoFocus
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />

          <PasswordField
            control={form.control}
            name="confirm"
            label="Confirm Password"
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
          />

          {done ? (
            <Alert className="items-start">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              <AlertDescription>
                Password changed. Signing you out everywhere — sign in again
                with the new one.
              </AlertDescription>
            </Alert>
          ) : null}

          <FormAlert>{failure}</FormAlert>

          <SubmitButton pending={form.formState.isSubmitting || done}>
            Set password
          </SubmitButton>
        </form>
      </Form>
    </AuthCard>
  );
}
