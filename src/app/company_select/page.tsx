import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthCard } from "@/components/auth/fields";
import { AuthHeading } from "@/components/auth/auth-shell";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { api, unpaidCompanyIds } from "@/lib/api";
import { customerApi } from "@/lib/customer";
import { myProfile } from "@/lib/portal";

export const metadata: Metadata = { title: "Select workspace – FinOpSys" };

/**
 * Workspace picker, the landing route after a verified OTP.
 *
 * 1.0 spells this route "/comany_select". The typo is NOT carried over: a
 * misspelling in a URL is permanent in a way a misspelling on screen is not —
 * it is bookmarked, pasted into tickets, and read out loud. `redirects()` in
 * next.config.ts 308s the old path here so 1.0's links keep working, and that
 * runs ahead of the proxy, so an old link resolves before the auth guard ever
 * sees it.
 *
 * Shown even for a single company, as 1.0 does — a
 * one-row picker is the only thing that tells an owner which workspace they
 * are about to enter, and skipping it made the page look broken.
 */
export default async function WorkspaceSelectPage() {
  /*
   * The status read is no longer only the empty branch's business: it names
   * which companies are unpaid, and that is a chip on a row here rather than a
   * redirect away from the page. One request for the ordinary path too, spent
   * on the one screen where an owner chooses what to open.
   */
  const [workspaces, status] = await Promise.all([
    customerApi.workspaces(),
    api.onboardingStatus(),
  ]);
  const unpaid = unpaidCompanyIds(status);

  /*
   * NOTHING TO PICK MEANS TWO DIFFERENT THINGS, and only one of them is
   * onboarding.
   *
   * An OWNER with no company is mid-signup — this is where a customer lands
   * from `/`, from the logo, and from the back-button bounce off /login, so an
   * empty picker would be a card with a heading and no way forward. The company
   * step is what they were on.
   *
   * A TEAMMATE with an empty list has not been put on anything yet. There is no
   * company step for them — sending them to it was a LOOP, not a dead end, since
   * that page bounces a non-owner straight back here — and it asked someone
   * whose access comes from `company_members` to create a company instead.
   *
   * Both branches read the status fetched above.
   */
  if (workspaces.length === 0) {
    if (status.isOwner) {
      // The profile read happens only here, since the step is addressed by email.
      const { email } = await myProfile();
      redirect(`/on_boarding_form_part_1?email=${encodeURIComponent(email)}`);
    }

    /*
     * A teammate with nothing to open: their access was revoked, or the invite
     * named a company that has since been removed.
     *
     * This used to be EVERY teammate, because `workspaces()` read
     * `/companies/owned`. It now reads `/companies`, whose access filter counts
     * `company_members` — so an invited teammate lands on the picker with their
     * companies in it and never reaches this branch.
     */
    return (
      <AuthShell>
        <AuthCard>
          <AuthHeading title="No Workspaces Yet">
            Your account is not on a company yet. Ask whoever invited you to
            give you access, then sign in again.
          </AuthHeading>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeading title="Select Workspace">
          Choose a company to continue.
        </AuthHeading>

        <ul className="space-y-2">
          {workspaces.map((workspace) => {
            /*
             * AN UNPAID COMPANY IS A ROW, NOT A ROADBLOCK. It is listed with
             * the rest and opens its own plan step instead of the portal — so
             * a draft company left unpaid costs its owner that one workspace,
             * and never the others. The chip is what says why the row goes
             * somewhere else before it is clicked.
             */
            const owes = unpaid.includes(workspace.id);

            return (
              <li key={workspace.id}>
                <Link
                  href={
                    owes
                      ? `/on_boarding_form_part_2?compID=${encodeURIComponent(workspace.id)}`
                      : `/customer/${workspace.id}/projects`
                  }
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors duration-150 hover:border-primary/25 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  <InitialsAvatar name={workspace.name} />
                  <span className="flex-1 text-sm font-medium">
                    {workspace.name}
                  </span>
                  {owes && <Badge variant="destructive">Complete payment</Badge>}
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </AuthCard>
    </AuthShell>
  );
}
