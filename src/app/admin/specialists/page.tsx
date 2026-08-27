import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { adminApi, type Specialist } from "@/lib/admin";
import { InviteSpecialist } from "./invite-specialist";

export const metadata: Metadata = { title: "Specialists" };

export default async function SpecialistsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);
  const { rows, total } = await adminApi.specialists(page);

  return (
    <>
      <PageHeader title="Specialists" action={<InviteSpecialist />} />

      <DataTable<Specialist>
        page={page}
        total={total}
        rows={rows}
        basePath="/admin/specialists"
        empty="No specialists yet. Invite one to get started."
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
