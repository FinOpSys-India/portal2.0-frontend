"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";

import { AuthCard, StaticField, SubmitButton } from "@/components/auth/fields";
import { AuthHeading, BackToLogin } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { api, landingPathFor } from "@/lib/api";
import { otpSchema, type OtpValues } from "@/lib/schemas";

const RESEND_COOLDOWN = 30;

/**
 * Verify-code step, shared by the login, signup and password-reset routes.
 *
 * TWO CHALLENGES, ONE SCREEN. `/auth/otp` and `/auth/password-reset/otp` are
 * different endpoints that ask the identical question and end somewhere
 * different: login's answer is a session, reset's is a short-lived
 * `resetToken` that the next screen spends. `purpose` picks the pair — a second
 * copy of this component would be the same six boxes with two lines changed.
 *
 * 1.0 drew six loose boxes with en-dashes between them; this is one grouped
 * control, which is what the pattern has settled on everywhere else.
 */
export function OtpForm({
  challengeId,
  email,
  showBackToLogin = false,
  purpose = "login",
}: {
  /** The UUID from `POST /auth/login`. Both verify and resend spend this. */
  challengeId: string;
  /** Server-masked address, display only. */
  email: string;
  showBackToLogin?: boolean;
  /** Which challenge this code answers, and therefore where it leads. */
  purpose?: "login" | "reset";
}) {
  const router = useRouter();
  const [failure, setFailure] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  const form = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const onSubmit = React.useCallback(
    async (values: OtpValues) => {
      setFailure(null);
      try {
        if (purpose === "reset") {
          /*
           * The reset token goes in the URL because the next screen is a
           * separate route and there is nowhere else to put it that survives a
           * navigation. It is single-use and short-lived by design — a reset
           * flow whose token could be replayed would be worse than the password
           * it is replacing.
           */
          const { resetToken } = await api.verifyPasswordResetOtp(
            challengeId,
            values.code,
          );
          router.push(
            `/forgot_password/new?token=${encodeURIComponent(resetToken)}`,
          );
          return;
        }

        const session = await api.verifyOtp(challengeId, values.code);
        router.push(await landingPathFor(session));
      } catch (err) {
        setFailure(err instanceof Error ? err.message : "Verification failed.");
        form.reset({ code: "" });
      }
    },
    [form, router, challengeId, purpose],
  );

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function onResend() {
    setFailure(null);
    try {
      // The server states its own cooldown; the local constant is only the
      // fallback for a response that omits it.
      const { resendAvailableInSeconds } =
        purpose === "reset"
          ? await api.resendPasswordResetOtp(challengeId)
          : await api.resendOtp(challengeId);
      setCooldown(resendAvailableInSeconds || RESEND_COOLDOWN);
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not resend the code.",
      );
    }
  }

  return (
    <AuthCard>
      <div className="space-y-4">
        {showBackToLogin ? <BackToLogin /> : null}

        <AuthHeading title="Verify code">
          We sent a 6-digit code to your email.
        </AuthHeading>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {email ? (
            <StaticField label="Email Address" value={email} icon={Mail} />
          ) : null}

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Verification Code
                  <span className="text-destructive" aria-hidden>
                    *
                  </span>
                </FormLabel>
                <FormControl>
                  <InputOTP
                    {...field}
                    maxLength={6}
                    autoFocus
                    disabled={form.formState.isSubmitting}
                    containerClassName="w-full"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(value) => {
                      field.onChange(value);
                      setFailure(null);
                      // Six digits is the whole input — a click after it is
                      // busywork. isSubmitting stops a paste-then-click from
                      // firing the request twice.
                      if (value.length === 6 && !form.formState.isSubmitting) {
                        void form.handleSubmit(onSubmit)();
                      }
                    }}
                  >
                    <InputOTPGroup className="w-full gap-2">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          // Same 10px radius as every other control; taller
                          // because a single character needs a bigger target.
                          className="h-13 flex-1 rounded-lg border border-input bg-card text-lg shadow-none transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] first:rounded-l-lg first:border-l last:rounded-r-lg data-[active=true]:border-primary data-[active=true]:ring-0"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormAlert>{failure}</FormAlert>

          <SubmitButton pending={form.formState.isSubmitting}>
            Verify
          </SubmitButton>

          <p className="text-center text-sm text-muted-foreground">
            Didn&rsquo;t receive a code?{" "}
            <button
              type="button"
              onClick={onResend}
              disabled={cooldown > 0}
              className="rounded-xs font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
            </button>
          </p>
        </form>
      </Form>
    </AuthCard>
  );
}
