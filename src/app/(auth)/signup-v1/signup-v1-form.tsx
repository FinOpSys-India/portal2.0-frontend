"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, landingPathFor } from "@/lib/api";
import type { Invite } from "@/app/(auth)/signup_2938/signup-form";
import { cn } from "@/lib/utils";

/**
 * Portal 1.0's signup form.
 *
 * Field: 40px tall, 1px #313131, 4px radius, 16px text.
 * Button: 48px, #7F56D9, 4px radius, 14px/600.
 *
 * Reproduced rather than fixed, because this route exists to show what 1.0 is:
 *   - no focus treatment on any control
 *   - no validation messages, including on a password mismatch
 *   - the confirm field stays disabled until the password field has a value
 */
const FIELD =
  "h-10 rounded-[4px] border-[#313131] bg-white px-3 py-1.5 text-base text-[#1a1a1a] shadow-none md:text-base placeholder:text-[#9e9e9e] focus-visible:ring-0 disabled:bg-[#dcdcdc] disabled:text-[#9e9e9e] disabled:opacity-100";

/**
 * ponytail: 1.0 only ever showed us "No Password" (empty) and "Strong"
 * (fosDEMO@123!). The middle rungs are a guess — replace the thresholds if
 * the real Bubble rule turns up.
 */
function strengthLabel(password: string): string {
  if (!password) return "No Password";
  const score =
    Number(password.length >= 8) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (score <= 1) return "Weak";
  if (score <= 3) return "Medium";
  return "Strong";
}

export function SignupV1Form({ invite }: { invite: Invite }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // 1.0 keeps the confirm field disabled until the password field has a value.
  const confirmDisabled = password.length === 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) return; // 1.0 says nothing here.
    setPending(true);
    try {
      const session = await api.signup({
        invitationToken: invite.token,
        email: invite.email,
        firstName: invite.firstName,
        lastName: invite.lastName,
        password,
      });
      router.push(await landingPathFor(session));
    } catch {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-[40px] leading-tight font-bold tracking-tight text-black">
        Sign up
      </h1>
      <p className="mt-3 text-base text-[#525252]">
        Sign up to access your FinOpSys account
      </p>

      <div className="mt-[38px] space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="v1-signup-email"
            className="block text-sm font-normal text-black"
          >
            Email
          </label>
          <Input
            id="v1-signup-email"
            type="email"
            placeholder="Enter your email"
            value={invite.email}
            readOnly
            disabled
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="v1-signup-password"
            className="block text-sm font-normal text-black"
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="v1-signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="***********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(FIELD, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#667085]"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
          <p className="text-sm text-[#525252]">{strengthLabel(password)}</p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="v1-signup-confirm"
            className="block text-sm font-normal text-black"
          >
            Re-enter password
          </label>
          <div className="relative">
            <Input
              id="v1-signup-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="***********"
              value={confirm}
              disabled={confirmDisabled}
              onChange={(e) => setConfirm(e.target.value)}
              className={cn(FIELD, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              disabled={confirmDisabled}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#667085] disabled:opacity-50"
            >
              {showConfirm ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <div className="pt-5">
          <Button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-[4px] text-sm font-semibold"
          >
            Sign Up
          </Button>
        </div>

        <p className="text-center text-sm">
          <Link
            href="/login-v1"
            className="text-[#7f56d9] underline underline-offset-2"
          >
            Already have an account? Click here to Login
          </Link>
        </p>
      </div>
    </form>
  );
}
