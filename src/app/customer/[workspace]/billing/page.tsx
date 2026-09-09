import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/portal/portal-shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { subscription, type SubscriptionLine } from "@/lib/billing";
import { formatMoney } from "@/lib/plans";

import { ManageBilling } from "./manage-billing";

export const metadata: Metadata = { title: "Billing" };

/** M/D/YYYY, the format every other date in this portal renders in. */
function stamp(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-US") : "—";
}

/**
 * The words for one line.
 *
 * A payroll subscription is THREE rows sharing one service — the base fee and
 * the two per-head prices — so the service name alone would print "Payroll"
 * three times against three different amounts. The component says which.
 */
const COMPONENTS: Record<string, string> = {
  base: "Base",
  employees: "W-2 employees",
  contractors: "1099 contractors",
};

function lineLabel(line: SubscriptionLine): string {
  const service = line.service ?? "Service";
  const part = COMPONENTS[line.component];
  return part ? `${service} · ${part}` : service;
}

/** ACTIVE reads as normal; anything else is worth the reader's attention. */
function statusTone(status: string) {
  if (status === "ACTIVE" || status === "TRIALING") return "secondary" as const;
  return "destructive" as const;
}

/**
 * What this company pays, from `GET /billing/subscription`.
 *
 * OWNER-ONLY, and the page says so rather than rendering an empty table at a
 * teammate: billing access is narrower than the rest of the portal (see
 * `billingAccess.js`), so an invited TEAM member reaches this route
 * legitimately and gets a 403 from that one endpoint.
 *
 * Every amount here is the price CAPTURED AT PURCHASE, not today's list price —
 * which is why this page can be trusted against a card statement, and why it
 * may legitimately differ from what the plan step is currently quoting.
 */
export default async function BillingPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const view = await subscription(workspace);

  if (view.state === "forbidden") {
    return (
      <>
        <PageHeader title="Billing" />
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Only the company owner can see billing. Ask them for an invoice or a
          change of plan.
        </p>
      </>
    );
  }

  if (view.state === "none") {
    return (
      <>
        <PageHeader title="Billing" />
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            This company has no subscription yet.
          </p>
          <Link
            href="/on_boarding_form_part_2"
            className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Choose a plan
          </Link>
        </div>
      </>
    );
  }

  const { subscription: sub } = view;

  return (
    <>
      <PageHeader
        title="Billing"
        action={<ManageBilling companyId={workspace} />}
      />

      <div className="grid gap-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <Field label="Status">
              <Badge variant={statusTone(sub.status)} className="capitalize">
                {sub.status.toLowerCase().replace("_", " ")}
              </Badge>
            </Field>
            <Field label="Current period">
              <span className="text-sm font-medium tabular-nums">
                {stamp(sub.currentPeriodStart)} – {stamp(sub.currentPeriodEnd)}
              </span>
            </Field>
            <Field
              label={sub.cancelAtPeriodEnd ? "Ends on" : "Renews on"}
            >
              <span className="text-sm font-medium tabular-nums">
                {stamp(sub.currentPeriodEnd)}
              </span>
            </Field>
          </div>

          {/* A subscription that is still ACTIVE but already cancelled looks
              identical to a healthy one on every other field, and the customer
              finds out when it stops. Said here instead. */}
          {sub.cancelAtPeriodEnd ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Cancelled. Your services stay live until{" "}
              {stamp(sub.currentPeriodEnd)}.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">What you pay for</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sub.lines.map((line) => (
                  <TableRow key={`${line.service}-${line.component}`}>
                    <TableCell className="font-medium capitalize">
                      {lineLabel(line)}
                    </TableCell>
                    <TableCell>{line.planName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.unitAmountMinor, line.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.totalAmountMinor, line.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-sm font-medium">Monthly total</span>
            <span className="text-xl font-bold tabular-nums">
              {formatMoney(sub.recurringTotalAmountMinor, sub.currency)}
              <span className="text-sm font-normal text-muted-foreground">
                /mo
              </span>
            </span>
          </div>
        </section>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
