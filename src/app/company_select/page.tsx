import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { AuthCard } from "@/components/auth/fields";
import { AuthHeading } from "@/components/auth/auth-shell";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { customerApi } from "@/lib/customer";

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
  const workspaces = await customerApi.workspaces();

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeading title="Select workspace">
          Choose a company to continue.
        </AuthHeading>

        <ul className="space-y-2">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <Link
                href={`/customer/${workspace.id}/projects`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors duration-150 hover:border-primary/25 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              >
                <InitialsAvatar name={workspace.name} />
                <span className="flex-1 text-sm font-medium">
                  {workspace.name}
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </AuthCard>
    </AuthShell>
  );
}
