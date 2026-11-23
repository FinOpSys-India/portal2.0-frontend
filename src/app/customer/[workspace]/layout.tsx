import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CustomerShell } from "@/components/customer/customer-shell";
import { MeetingsLink } from "@/components/portal/meetings-link";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  CompanyActiveSwitch,
  DeleteCompany,
  FrozenNotice,
} from "@/components/portal/record-controls";
import { api, unpaidCompanyIds } from "@/lib/api";
import { customerApi } from "@/lib/customer";
import { groupMeetings, meetingsApi, meetingsEnabled } from "@/lib/meetings";
import { mustPayToReactivate } from "@/lib/portal";

export const metadata: Metadata = {
  title: { default: "FinOpSys", template: "%s – FinOpSys" },
};

/**
 * The Meetings icon's number: invitations on this company that wait on the
 * reader's answer. Its own boundary, and swallowed, like the bell: an unpaid
 * company 402s here and that must not take the frame down.
 */
async function MeetingsBadge({ workspace }: { workspace: string }) {
  const meetings = await meetingsApi.list(workspace).catch(() => []);
  return (
    <MeetingsLink
      href={`/customer/${workspace}/meetings`}
      count={groupMeetings(meetings, "customer").needsReply.length}
    />
  );
}

export default async function CustomerLayout({
  params,
  children,
}: {
  params: Promise<{ workspace: string }>;
  children: React.ReactNode;
}) {
  const { workspace: id } = await params;
  // Only what the frame cannot be drawn without. The bell is one request per
  // workspace and hangs off its own boundary below, because a chat gate (an
  // unpaid account 402s there) must not take the whole portal frame down.
  // `/companies/owned` filters on `ownerUserId`, so a teammate matches nothing
  // and loses the owner-only nav rows. It fails closed on error for the same
  // reason the bell does: a frame that renders beats a frame that throws.
  // The onboarding read fails closed alongside the owned-company one: it only
  // decides whether a switcher row carries a payment tag, and a frame that
  // renders beats a frame that throws.
  // The service groups are the sidebar itself. They ride on the workspace read
  // above plus the project list, and both are memoized: a Projects or
  // Documents page under this layout reads them again for nothing.
  const [workspaces, profile, owned, status, services] = await Promise.all([
    customerApi.workspaces(),
    customerApi.profile(),
    api.ownedCompanies().catch(() => []),
    api.onboardingStatus().catch(() => null),
    customerApi.serviceGroups(id),
  ]);
  const workspace = workspaces.find((w) => w.id === id);

  // An unknown workspace is a 404, not an empty portal — otherwise a typo in
  // the URL renders a working-looking page with nobody's data in it.
  if (!workspace) notFound();
  const owner = owned.some((c) => String(c.companyId) === id);

  /*
   * An inactive company is frozen (16 Nov): every page under it — projects,
   * tasks, documents, chat — is replaced by its name and a notice. The owner
   * keeps the two things they can still do here, turn it back on or delete it.
   * The paid-until date is read only then, for the Complete Payment rule.
   */
  const company =
    workspace.inactive && owner ? await customerApi.company(id) : null;
  const body = workspace.inactive ? (
    <div className="grid gap-6">
      <PageHeader
        title="Company Details"
        description={workspace.name}
        action={
          company ? (
            <span className="flex flex-wrap items-center gap-4">
              <CompanyActiveSwitch
                companyId={id}
                name={workspace.name}
                inactive
                mustPay={mustPayToReactivate(
                  company.paidUntil,
                  !!status && unpaidCompanyIds(status).includes(id),
                )}
              />
              <DeleteCompany
                companyId={id}
                name={workspace.name}
                after="/company_select"
              />
            </span>
          ) : undefined
        }
      />
      <FrozenNotice>
        {owner
          ? "This company is inactive, so nothing under it can be opened. Make it active to open it again."
          : "This company is inactive, so nothing under it can be opened until its owner makes it active again."}
      </FrozenNotice>
    </div>
  ) : (
    children
  );

  return (
    <CustomerShell
      workspace={workspace}
      // Inactive companies leave the switcher (4 Nov decision) — except the
      // one being read, or the pill would have nothing to name.
      workspaces={workspaces.filter((w) => !w.inactive || w.id === id)}
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
      owner={owner}
      services={services}
      unpaid={status ? unpaidCompanyIds(status) : []}
      meetings={
        // Not on a frozen company: nothing under it opens (16 Nov).
        meetingsEnabled() && !workspace.inactive ? (
          <Suspense
            fallback={
              <MeetingsLink href={`/customer/${id}/meetings`} count={0} />
            }
          >
            <MeetingsBadge workspace={id} />
          </Suspense>
        ) : undefined
      }
    >
      {body}
    </CustomerShell>
  );
}
