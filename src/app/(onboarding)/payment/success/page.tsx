import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { AuthShell, AuthHeading } from "@/components/auth/auth-shell";
import { AuthCard } from "@/components/auth/fields";
import { api } from "@/lib/api";
import { RedirectAfter } from "./redirect-after";

export const metadata: Metadata = { title: "Payment – FinOpSys" };

/**
 * Where Stripe Checkout returns.
 *
 * `config.billing.checkoutSuccessUrl` is
 * `<FRONTEND_URL>/payment/success?session_id={CHECKOUT_SESSION_ID}` and no
 * route answered it, so a customer who had just paid landed on a 404.
 *
 * The page does NOT assume success. Stripe redirects here as soon as the
 * session completes, which for an asynchronous method (bank debit) is days
 * before the money settles — `GET /billing/checkout-status` collapses that into
 * one value and `processing` is a real, common answer. Claiming "paid" on
 * arrival would be a lie the backend never told.
 *
 * Note `session_id` (Stripe's spelling) rather than `sessionId`. The backend
 * accepts either on the way in; only this side is fixed by Stripe.
 */
const OUTCOMES: Record<
  string,
  { icon: typeof CheckCircle2; tone: string; title: string; body: string }
> = {
  paid: {
    icon: CheckCircle2,
    tone: "text-success",
    title: "You're all set",
    body: "Payment went through and your subscription is live.",
  },
  processing: {
    icon: Clock,
    tone: "text-amber-500",
    title: "Payment is processing",
    body: "Your bank has not settled this yet. We'll email you the moment it clears — no need to pay again.",
  },
  pending: {
    icon: Clock,
    tone: "text-muted-foreground",
    title: "Checkout not finished",
    body: "We haven't received a payment for this session yet.",
  },
  cancelled: {
    icon: XCircle,
    tone: "text-muted-foreground",
    title: "Checkout cancelled",
    body: "The session was cancelled or expired. Pick your services again to retry.",
  },
  failed: {
    icon: XCircle,
    tone: "text-destructive",
    title: "Payment failed",
    body: "The payment did not go through. Try again with a different card.",
  },
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; sessionId?: string }>;
}) {
  const { session_id, sessionId } = await searchParams;
  const id = session_id ?? sessionId ?? "";

  let status = "pending";
  if (id) {
    // A read failure is not a payment failure. Showing "pending" leaves the
    // customer somewhere honest instead of an error page after they have paid.
    try {
      ({ status } = await api.checkoutStatus(id));
    } catch {
      status = "pending";
    }
  }

  const outcome = OUTCOMES[status] ?? OUTCOMES.pending;
  const Icon = outcome.icon;
  const settled = status === "paid" || status === "processing";
  const paid = status === "paid";

  return (
    <AuthShell>
      <AuthCard>
        <Icon className={`size-10 ${outcome.tone}`} aria-hidden />
        <AuthHeading title={outcome.title}>{outcome.body}</AuthHeading>

        <Link
          href={settled ? "/company_select" : "/on_boarding_form_part_2"}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          {settled ? "Go to your workspace" : "Back to plans"}
        </Link>

        {/* The link stays. The redirect is a convenience, and a page whose only
            way forward is a timer is one a slow network or a blocked script
            strands you on. */}
        {paid ? (
          <>
            <p className="text-center text-xs text-muted-foreground">
              Taking you to your workspace&hellip;
            </p>
            <RedirectAfter to="/company_select" />
          </>
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}
