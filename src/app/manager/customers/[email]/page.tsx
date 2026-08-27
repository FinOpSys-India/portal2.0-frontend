import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { PageHeader } from "@/components/portal/portal-shell";
import { managerApi } from "@/lib/manager";

export const metadata: Metadata = { title: "Customer" };

/**
 * Customer detail, read-only — the same two sections 1.0 shows, and the same
 * ones admin renders on its copy of this screen.
 */
export default async function ManagerCustomerPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const customer = await managerApi.customer(decodeURIComponent(email));

  if (!customer) notFound();

  return (
    <>
      <PageHeader title="Customer Information" description={customer.name} />

      <div className="grid gap-6">
        <DetailSection title="General Information">
          <DetailRow label="Full Name" value={customer.name} />
          <DetailRow label="Email Address" value={customer.email} />
          <DetailRow label="Position" value={customer.position} />
          <DetailRow label="Phone Number" value={customer.phone} />
        </DetailSection>

        {/* Rendered even when empty — the customer fills these from their own
            portal, and a missing row reads as a missing field. */}
        <DetailSection title="Full Address Information">
          <DetailRow label="Address Line 1" value={customer.addressLine1} />
          <DetailRow label="City" value={customer.city} />
          <DetailRow label="State" value={customer.state} />
          <DetailRow label="ZIP Code" value={customer.zip} />
          <DetailRow label="Country" value={customer.country} />
        </DetailSection>
      </div>
    </>
  );
}
