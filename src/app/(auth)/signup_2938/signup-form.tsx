"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, User } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import {
  AuthCard,
  PasswordField,
  StaticField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";
import { AuthHeading } from "@/components/auth/auth-shell";
import { FormAlert } from "@/components/auth/form-alert";
import { Form } from "@/components/ui/form";
import { api, landingPathFor } from "@/lib/api";
import { signupSchema, type SignupValues } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * ponytail: 1.0 only ever showed us "No Password" (empty) and "Strong"
 * (fosDEMO@123!). The middle rungs are a reasonable guess — replace the
 * thresholds if the real Bubble rule turns up.
 */
const LEVELS = [
  { label: "Too short", bars: 0, tone: "bg-border" },
  { label: "Weak", bars: 1, tone: "bg-destructive" },
  { label: "Medium", bars: 2, tone: "bg-amber-500" },
  { label: "Strong", bars: 3, tone: "bg-success" },
] as const;

function strengthOf(password: string) {
  if (!password) return null;
  const score =
    Number(password.length >= 8) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (password.length < 8) return LEVELS[0];
  if (score <= 1) return LEVELS[1];
  if (score <= 3) return LEVELS[2];
  return LEVELS[3];
}

/**
 * The invite link's payload.
 *
 * All four come from the URL because the backend has no public endpoint that
 * resolves an invitation token into the person it was issued to — `GET
 * /invitations` lists them but needs an authenticated inviter, which a
 * signing-up user is not. So the invite email has to carry the details, and
 * `POST /auth/signup` requires every one of them.
 */
export interface Invite {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
}

export function SignupForm({ invite }: { invite: Invite }) {
  const router = useRouter();
  const [failure, setFailure] = React.useState<string | null>(null);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      password: "",
      confirm: "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const password = useWatch({ control: form.control, name: "password" });
  const strength = strengthOf(password);
  // The backend emails `/accept-invitation?token=…` and nothing else, so a real
  // invitation link arrives without these. Shown read-only when a link does
  // carry them, typed when it does not — signup rejects them empty either way.
  const knownIdentity = Boolean(
    invite.email && invite.firstName && invite.lastName,
  );

  async function onSubmit(values: SignupValues) {
    setFailure(null);
    if (!invite.token) {
      setFailure("This invitation link is incomplete. Ask for a new one.");
      return;
    }
    try {
      // Completing an invitation signs you in outright — the emailed token is
      // already proof of control of the address, so there is no code to verify.
      const session = await api.signup({
        invitationToken: invite.token,
        email: values.email.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        password: values.password,
      });
      router.push(await landingPathFor(session));
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not create your account.",
      );
    }
  }

  return (
    <AuthCard>
      <AuthHeading title="Create your account">
        Set a password to finish setting up your FinOpSys account.
      </AuthHeading>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          {knownIdentity ? (
            <>
              <StaticField
                label="Email Address"
                value={invite.email}
                icon={Mail}
              />
              <StaticField
                label="Name"
                value={`${invite.firstName} ${invite.lastName}`}
                icon={User}
              />
            </>
          ) : (
            <>
              <TextField
                control={form.control}
                name="email"
                label="Email Address"
                icon={Mail}
                required
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  control={form.control}
                  name="firstName"
                  label="First Name"
                  icon={User}
                  required
                  autoComplete="given-name"
                />
                <TextField
                  control={form.control}
                  name="lastName"
                  label="Last Name"
                  required
                  autoComplete="family-name"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <PasswordField
              control={form.control}
              name="password"
              label="Password"
              icon={Lock}
              required
              autoComplete="new-password"
              autoFocus
              placeholder="At least 8 characters"
            />

            {/* Bars carry the judgement; the word names it for screen readers. */}
            {strength ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1" aria-hidden>
                  {[1, 2, 3].map((bar) => (
                    <span
                      key={bar}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                        bar <= strength.bars ? strength.tone : "bg-border",
                      )}
                    />
                  ))}
                </div>
                <span
                  className="text-xs text-muted-foreground tabular-nums"
                  aria-live="polite"
                >
                  {strength.label}
                </span>
              </div>
            ) : null}
          </div>

          <PasswordField
            control={form.control}
            name="confirm"
            label="Confirm Password"
            icon={Lock}
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
          />

          <FormAlert>{failure}</FormAlert>

          <SubmitButton pending={form.formState.isSubmitting}>
            Create account
          </SubmitButton>
        </form>
      </Form>
    </AuthCard>
  );
}

