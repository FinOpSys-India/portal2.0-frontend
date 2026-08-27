"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Portal 1.0's login form, measured off the live Bubble app.
 *
 * Field: 40px tall, 1px #313131, 4px radius, 16px text, 6px/12px padding.
 * Button: 48px, #7F56D9, 4px radius, 14px/600.
 * Links: Forgot Password 14px/500 #7F56D9, FAQs 12px/600 #0C29AB, both
 * right-aligned and underlined.
 *
 * Two things 1.0 does that are reproduced here rather than fixed, because
 * this route exists to show what 1.0 is:
 *   - no focus treatment on any control
 *   - no validation messages of any kind
 */
const FIELD =
  "h-10 rounded-[4px] border-[#313131] bg-white px-3 py-1.5 text-base text-[#1a1a1a] shadow-none md:text-base placeholder:text-[#9e9e9e] focus-visible:ring-0";

export function LoginV1Form() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const challenge = await api.login(email.trim(), password);
      router.push(
        `/otp_page_login?challenge=${encodeURIComponent(challenge.challengeId)}` +
          `&email=${encodeURIComponent(challenge.maskedEmail)}`,
      );
    } catch {
      // 1.0 shows nothing when a login fails. Reproduced, not endorsed.
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="text-[40px] leading-tight font-bold tracking-tight text-black">
        Login
      </h1>
      <p className="mt-3 text-base text-[#525252]">
        Login to access your FinOpSys account
      </p>

      <div className="mt-[38px] space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="v1-email"
            className="block text-sm font-normal text-black"
          >
            Email
          </label>
          <Input
            id="v1-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="v1-password"
            className="block text-sm font-normal text-black"
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="v1-password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(FIELD, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#667085]"
            >
              {visible ? (
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
            Login
          </Button>

          <div className="mt-2 flex flex-col items-end gap-0.5">
            <Link
              href="/forgot_password"
              className="text-sm font-medium text-[#7f56d9] underline underline-offset-2"
            >
              Forgot Password?
            </Link>
            <Link
              href="/faq-public"
              className="text-xs font-semibold text-[#0c29ab] underline underline-offset-2"
            >
              FAQs
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
