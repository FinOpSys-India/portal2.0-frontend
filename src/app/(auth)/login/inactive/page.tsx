import type { Metadata } from "next";
import Link from "next/link";

import { AUTH_PANELS, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { AuthCard } from "@/components/auth/fields";
import { EndSession } from "./end-session";

export const metadata: Metadata = { title: "Signed Out – FinOpSys" };

/**
 * Where src/lib/http.ts sends a session whose account an admin made Inactive.
 *
 * Its own page rather than a message on /login: the proxy sends a request for
 * /login that still holds an access cookie straight back to the portal, and the
 * portal answers 403 again — so the session has to be cleared first, from here,
 * which the proxy never guards (see the `login` exclusion in its matcher).
 */
export default function InactiveAccountPage() {
  return (
    <AuthShell panel={AUTH_PANELS.login}>
      <AuthCard>
        <AuthHeading title="You have been signed out">
          Your account was made inactive by an administrator. Please contact
          your administrator for help.
        </AuthHeading>

        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          Back to Log In
        </Link>

        <EndSession />
      </AuthCard>
    </AuthShell>
  );
}
