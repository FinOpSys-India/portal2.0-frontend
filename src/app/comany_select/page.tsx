import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
 * Route name keeps 1.0's typo ("comany") so existing links and the redirect in
 * lib/api.ts keep working. 1.0 shows this screen even with a single company;
 * here one company skips straight through, because a chooser with one choice
 * is a click that teaches nothing.
 */
export default async function WorkspaceSelectPage() {
  const workspaces = await customerApi.workspaces();

  if (workspaces.length === 1) {
    redirect(`/customer/${workspaces[0].id}/projects`);
  }

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
