import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChipsCell } from "@/components/admin/data-table";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { StaffActiveSwitch } from "@/components/portal/record-controls";
import { adminApi } from "@/lib/admin";

export const metadata: Metadata = { title: "Accounting Manager" };

/**
 * Accounting manager detail. Only what the directory row carries until the
 * backend has a manager profile read; phone and address arrive with it.
 */
export default async function AccountingManagerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const manager = await adminApi.accountingManager(decodeURIComponent(email));

  if (!manager) notFound();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            name={manager.name}
            src={manager.avatarUrl}
            className="size-11 text-sm"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{manager.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {manager.email}
            </p>
          </div>
        </div>
        {/* No switch until they sign up: the server refuses one (409). */}
        {manager.invited ? (
          <span className="text-sm text-muted-foreground">Invited</span>
        ) : (
          <StaffActiveSwitch
            userId={manager.userId}
            name={manager.name}
            inactive={manager.inactive}
            manager={true}
          />
        )}
      </div>

      <DetailSection title="General Information">
        <DetailRow label="Full Name" value={manager.name} />
        <DetailRow label="Email Address" value={manager.email} />
        <div className="@sm:col-span-2">
          <dt className="text-sm text-muted-foreground">Assigned Companies</dt>
          <dd className="mt-1">
            <ChipsCell items={manager.companies} />
          </dd>
        </div>
      </DetailSection>
    </>
  );
}
