import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChipsCell } from "@/components/admin/data-table";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { RoleBadge } from "@/components/admin/role-badge";
import { adminApi } from "@/lib/admin";

export const metadata: Metadata = { title: "Customer" };

/**
 * Customer detail. Read-only throughout: every field here is written by the
 * customer from their own portal, and admin has no edit path in 1.0.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const customer = await adminApi.customer(decodeURIComponent(email));

  if (!customer) notFound();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar name={customer.name} className="size-11 text-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {customer.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {customer.email}
            </p>
          </div>
        </div>
        <RoleBadge role={customer.role} />
      </div>

      <div className="grid gap-6">
        <DetailSection title="General information">
          <DetailRow label="Full name" value={customer.name} />
          <DetailRow label="Email address" value={customer.email} />
          <DetailRow label="Position" value={customer.position} />
          <DetailRow label="Phone number" value={customer.phone} />
          {/* A customer can belong to more than one company. */}
          <div>
            <dt className="text-sm text-muted-foreground">
              {customer.companies.length === 1 ? "Company" : "Companies"}
            </dt>
            <dd className="mt-1">
              <ChipsCell items={customer.companies} />
            </dd>
          </div>
        </DetailSection>

        <DetailSection title="Address">
          <DetailRow label="Address line 1" value={customer.addressLine1} />
          <DetailRow label="City" value={customer.city} />
          <DetailRow label="State" value={customer.state} />
          <DetailRow label="ZIP code" value={customer.zip} />
          <DetailRow label="Country" value={customer.country} />
        </DetailSection>
      </div>
    </>
  );
}
