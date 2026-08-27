"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { AuthHeading } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import {
  BOOKKEEPING_TIERS,
  PAYROLL,
  TAX_TIERS,
  formatMoney,
  payrollTotal,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

type Selection = {
  bookkeeping: string | null;
  taxes: string | null;
  payroll: { employees: number; contractors: number } | null;
};

export function PlanPicker({
  accountEmail,
  companyId,
}: {
  accountEmail: string;
  companyId: string;
}) {
  const [selection, setSelection] = React.useState<Selection>({
    bookkeeping: null,
    taxes: null,
    payroll: null,
  });
  const [employees, setEmployees] = React.useState("0");
  const [contractors, setContractors] = React.useState("0");
  const [failure, setFailure] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const bookkeeping = BOOKKEEPING_TIERS.find(
    (t) => t.id === selection.bookkeeping,
  );
  const taxes = TAX_TIERS.find((t) => t.id === selection.taxes);
  const payrollPrice = selection.payroll
    ? payrollTotal(selection.payroll.employees, selection.payroll.contractors)
    : 0;

  const total = (bookkeeping?.price ?? 0) + payrollPrice + (taxes?.price ?? 0);
  const empty = total === 0;

  // Live preview of what Add Payroll would cost, before it is added.
  const previewPayroll = payrollTotal(Number(employees) || 0, Number(contractors) || 0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (empty) return;

    setFailure(null);
    setPending(true);
    try {
      // Option IDS, not prices and not tier ids: the server resolves each one
      // to a plan code and then to a Stripe price, so a client that could name
      // a price could name its own.
      const { checkoutUrl } = await api.createCheckout({
        companyId: Number(companyId),
        bookkeepingOptionId: bookkeeping?.optionId ?? null,
        taxOptionId: taxes?.optionId ?? null,
        payroll: selection.payroll
          ? {
              employeeCount: selection.payroll.employees,
              contractorCount: selection.payroll.contractors,
            }
          : null,
      });
      // Payment is hosted by Stripe; the app hands off here.
      window.location.assign(checkoutUrl);
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not start checkout.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <AuthHeading title="Your plan">
        Pick the services you need. Change them any time.
      </AuthHeading>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-8">
          <Section
            title="Bookkeeping"
            description="Priced on how many transactions you run each month."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {BOOKKEEPING_TIERS.map((tier) => (
                <OptionCard
                  key={tier.id}
                  selected={selection.bookkeeping === tier.id}
                  title={tier.name}
                  detail={tier.detail}
                  price={`${formatMoney(tier.price)}/mo`}
                  onSelect={() =>
                    setSelection((s) => ({
                      ...s,
                      bookkeeping: s.bookkeeping === tier.id ? null : tier.id,
                    }))
                  }
                />
              ))}
            </div>
          </Section>

          <Section
            title="Payroll"
            description={`${formatMoney(PAYROLL.base)}/mo base, plus ${formatMoney(PAYROLL.perEmployee)} per W-2 employee and ${formatMoney(PAYROLL.perContractor)} per 1099 contractor.`}
          >
            <div className="rounded-xl border border-border p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="employees">W-2 employees</Label>
                  <Input
                    id="employees"
                    inputMode="numeric"
                    value={employees}
                    onChange={(e) =>
                      setEmployees(e.target.value.replace(/\D/g, ""))
                    }
                    className="h-11 rounded-lg border-input bg-card px-3.5 text-sm shadow-none hover:border-primary/35 focus-visible:border-primary focus-visible:ring-0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contractors">1099 contractors</Label>
                  <Input
                    id="contractors"
                    inputMode="numeric"
                    value={contractors}
                    onChange={(e) =>
                      setContractors(e.target.value.replace(/\D/g, ""))
                    }
                    className="h-11 rounded-lg border-input bg-card px-3.5 text-sm shadow-none hover:border-primary/35 focus-visible:border-primary focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  {formatMoney(previewPayroll)}
                  <span className="text-muted-foreground">/mo</span>
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setSelection((s) => ({
                      ...s,
                      payroll: s.payroll
                        ? null
                        : {
                            employees: Number(employees) || 0,
                            contractors: Number(contractors) || 0,
                          },
                    }))
                  }
                  className={cn(
                    "h-9 rounded-full border px-4 text-sm font-medium transition-colors duration-150",
                    selection.payroll
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/25 hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {selection.payroll ? "Added" : "Add payroll"}
                </button>
              </div>
            </div>
          </Section>

          <Section
            title="Taxes"
            description="Federal plus one state is included in every tier."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {TAX_TIERS.map((tier) => (
                <OptionCard
                  key={tier.id}
                  selected={selection.taxes === tier.id}
                  title={tier.name}
                  detail={`Additional state ${formatMoney(tier.additionalState)}`}
                  price={`${formatMoney(tier.price)}/mo`}
                  onSelect={() =>
                    setSelection((s) => ({
                      ...s,
                      taxes: s.taxes === tier.id ? null : tier.id,
                    }))
                  }
                />
              ))}
            </div>
            {/* 1.0 has the same gap: the company form offers a $10M+ band with
                no tax tier to match. Said out loud rather than hidden. */}
            <p className="mt-3 text-sm text-muted-foreground">
              Over $10M in revenue?{" "}
              <a
                href="mailto:hello@finopsys.ai"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Talk to us
              </a>{" "}
              about custom pricing.
            </p>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-8">
          <div className="rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold">Order summary</h2>

            {empty ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Select a service to see your total.
              </p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                {bookkeeping ? (
                  <SummaryRow
                    label="Bookkeeping"
                    detail={bookkeeping.name}
                    amount={bookkeeping.price}
                  />
                ) : null}
                {selection.payroll ? (
                  <SummaryRow
                    label="Payroll"
                    detail={`${selection.payroll.employees} W-2 · ${selection.payroll.contractors} contractor${selection.payroll.contractors === 1 ? "" : "s"}`}
                    amount={payrollPrice}
                  />
                ) : null}
                {taxes ? (
                  <SummaryRow
                    label="Taxes"
                    detail={taxes.name}
                    amount={taxes.price}
                  />
                ) : null}
              </dl>
            )}

            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm font-medium">Monthly total</span>
              <span className="text-xl font-bold tabular-nums">
                {formatMoney(total)}
                <span className="text-sm font-normal text-muted-foreground">
                  /mo
                </span>
              </span>
            </div>

            <FormAlert>{failure}</FormAlert>

            <div className="mt-4">
              <SubmitButton pending={pending} disabled={empty}>
                Get started
              </SubmitButton>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              You&rsquo;ll confirm payment on the next screen.
            </p>
          </div>

          <CustomPlanCard />
        </aside>
      </div>
    </form>
  );
}

/**
 * The custom-plan escape hatch, carried over from 1.0.
 *
 * There is no endpoint behind it. 1.0's own "Connect with us" only ever opened
 * a confirmation — the sales team works the account from the signup record —
 * and inventing a request the backend has nowhere to put would be a form that
 * silently discards what someone typed into it. So the dialog is the whole
 * feature, and it says only what is true: someone will be in touch.
 *
 * ponytail: if a real endpoint lands, this becomes a submit — the dialog is
 * already the success state it would need.
 */
function CustomPlanCard() {
  return (
    <div className="mt-4 rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold">Custom plan</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Our team will help you customize your requirements. Book a sales call
        and we&rsquo;ll price it around you.
      </p>

      <Dialog>
        {/* asChild so the trigger is the Button, not a button wrapping one.
            Radix sets type="button", which matters inside this <form>. */}
        <DialogTrigger asChild>
          <Button variant="outline" size="lg" className="mt-4 w-full">
            Connect with us
          </Button>
        </DialogTrigger>

        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-success">
              Thank you!
            </DialogTitle>
          </DialogHeader>

          <p className="text-muted-foreground">
            Our team will connect you shortly.
          </p>

          <DialogClose asChild>
            <Button size="lg" className="w-full">
              Return
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

/**
 * Selectable tier. A button rather than a radio because every group here is
 * optional and re-clicking clears it — a radio group cannot be un-picked.
 */
function OptionCard({
  selected,
  title,
  detail,
  price,
  onSelect,
}: {
  selected: boolean;
  title: string;
  detail: string;
  price: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative rounded-xl border p-4 text-left transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/35 hover:bg-accent",
      )}
    >
      {selected ? (
        <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" aria-hidden />
        </span>
      ) : null}
      <span className="block pr-6 text-sm font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {detail}
      </span>
      <span className="mt-3 block text-lg font-bold tabular-nums">{price}</span>
    </button>
  );
}

function SummaryRow({
  label,
  detail,
  amount,
}: {
  label: string;
  detail: string;
  amount: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </dt>
      <dd className="font-medium tabular-nums">{formatMoney(amount)}</dd>
    </div>
  );
}
