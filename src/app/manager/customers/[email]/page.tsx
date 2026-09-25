import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { PageHeader } from "@/components/portal/portal-shell";
import { managerApi, scopeSwitch, scoped } from "@/lib/manager";

export const metadata: Metadata = { title: "Customer" };

/**
 * Customer detail, read-only — the same two sections 1.0 shows, and the same
 * ones admin renders on its copy of this screen.
 */
export default async function ManagerCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ email: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const [{ email }, { company: picked }] = await Promise.all([
    params,
    searchParams,
  ]);
  // Scoped to the company on the URL: the same company the list that linked
  // here was under. Unscoped, the lookup merges rows across companies and the
  // check below compares against the wrong one — see `managerApi.customer`.
  const customer = await managerApi.customer(decodeURIComponent(email), picked);

  if (!customer) notFound();

  /*
   * A customer belongs to whichever of the manager's companies they are on —
   * often more than one, and this page is the same record under any of them.
   * Switching to a company they are NOT on is the reader leaving them behind,
   * and the Customers list of the company now on the pill is where they went.
   */
  const elsewhere = scopeSwitch({
    picked,
    owners: customer.companyIds,
    stay: `/manager/customers/${encodeURIComponent(customer.email)}`,
    leave: (to) => scoped("/manager/customers", to),
  });
  if (elsewhere) redirect(elsewhere);

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
