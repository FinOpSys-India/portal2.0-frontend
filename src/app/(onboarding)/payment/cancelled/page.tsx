import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Checkout cancelled – FinOpSys" };

/**
 * `config.billing.checkoutCancelUrl`. Stripe sends the customer here when they
 * back out, and nothing answered it — a 404 for someone who simply changed
 * their mind.
 *
 * Nothing was charged and nothing needs explaining, so this returns them to the
 * plan step with their company intact rather than showing a dead end. The plan
 * page resolves the company itself when no `compID` is carried.
 */
export default function PaymentCancelledPage() {
  redirect("/on_boarding_form_part_2");
}
