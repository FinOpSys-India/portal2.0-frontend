import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  companyScope,
  managerApi,
  scopeName,
  type Specialist,
} from "@/lib/manager";

export const metadata: Metadata = { title: "Specialists" };

/**
 * Specialists, read-only — 1.0's three columns exactly.
 *
 * Same route admin uses, rendered without the create action: a manager routes
 * work to specialists but cannot invite or remove them.
 *
 * Scoped by the header switcher through project assignment, since a specialist
 * belongs to no company directly.
 */
export default async function ManagerSpecialistsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const company = await companyScope((await searchParams).company);
  const specialists = await managerApi.specialists(company);

  return (
    <>
      <PageHeader title="Specialists" scope={await scopeName(company)} />

      <DataTable<Specialist>
        page={1}
        total={specialists.length}
        rows={specialists}
        basePath={`/manager/specialists${company ? `?company=${encodeURIComponent(company)}` : ""}`}
        rowHref={(row) =>
          `/manager/specialists/${encodeURIComponent(row.email)}`
        }
        empty={
          company
            ? "Nobody is working a project for this company yet."
            : "No specialists yet."
        }
        columns={[
          { header: "Name", cell: (row) => <PersonCell name={row.name} /> },
          { header: "Service Speciality", cell: (row) => row.speciality },
          {
            header: "Email",
            cell: (row) => (
              <span className="text-muted-foreground">{row.email}</span>
            ),
          },
        ]}
      />
    </>
  );
}
