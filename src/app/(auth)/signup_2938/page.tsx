import type { Metadata } from "next";

import { AUTH_PANELS, AuthLink, AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your account – FinOpSys",
};

/**
 * Landing page for an invitation link.
 *
 * 1.0 arrived here as `?email=<bubbleUserId>` and resolved the person
 * server-side. The Node backend has no public endpoint that turns an invitation
 * token into the invitee, so the link carries the details instead:
 *
 *   /signup_2938?token=<64 hex>&email=<address>&firstName=<..>&lastName=<..>
 *
 * `?email=` alone is still accepted so an old link shows the address rather
 * than an empty field, but signup will refuse without a token.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;
}) {
  const { token, email, firstName, lastName } = await searchParams;

  return (
    <AuthShell
      panel={AUTH_PANELS.signup}
      footer={
        <>
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <SignupForm
        invite={{
          token: token ?? "",
          email: email ?? "",
          firstName: firstName ?? "",
          lastName: lastName ?? "",
        }}
      />
    </AuthShell>
  );
}
