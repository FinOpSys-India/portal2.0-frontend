"use client";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Form-level failure — the request came back bad, as opposed to a field being
 * wrong. Portal 1.0 renders nothing at all in this case, which is how an
 * expired OTP looks identical to a working one.
 *
 * role="alert" so it is announced the moment it appears; the entrance is
 * opacity + a few pixels of travel, short enough not to delay reading it.
 */
export function FormAlert({ children }: { children?: string | null }) {
  if (!children) return null;

  return (
    <Alert variant="destructive" className="auth-enter items-start">
      <AlertCircle className="size-4" aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
