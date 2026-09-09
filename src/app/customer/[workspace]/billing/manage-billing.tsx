"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { portalSession } from "@/lib/billing";

/**
 * Into Stripe's hosted billing portal — card, invoices, receipts.
 *
 * Minted per click, never rendered into the page: `POST /billing/portal`
 * returns a single-use URL that expires, so a link baked into the HTML would be
 * dead by the time anyone pressed it (and would sit in the page source of a
 * screen other people can be shown).
 */
export function ManageBilling({ companyId }: { companyId: string }) {
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  async function open() {
    setFailure(null);
    setPending(true);
    try {
      window.location.assign(await portalSession(companyId));
    } catch (err) {
      setFailure(
        err instanceof Error ? err.message : "Could not open the billing portal.",
      );
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={open} disabled={pending}>
        {pending ? "Opening…" : "Manage billing"}
        <ExternalLink aria-hidden />
      </Button>
      {failure ? (
        <p role="alert" className="text-xs text-destructive">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
