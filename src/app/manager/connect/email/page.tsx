import type { Metadata } from "next";

import { EmailCompose } from "@/components/portal/email-compose";
import { managerApi, type Party } from "@/lib/manager";

export const metadata: Metadata = { title: "Email" };

/**
 * Compose behind both Connect email cards — 1.0 splits it across
 * `?name=customer` and `?name=specialist`; the party rides in the query here,
 * because the two screens differ only by who the To list holds.
 */
export default async function ManagerEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; party?: string }>;
}) {
  const { company, party } = await searchParams;
  const forParty: Party = party === "specialist" ? "specialist" : "customer";

  // Customers are scoped to the company on the switcher, matching 1.0.
  // Specialists are staff and belong to no company, so the list is the same
  // whichever company is selected.
  const recipients =
    forParty === "specialist"
      ? (await managerApi.specialists()).map((s) => ({
          value: s.email,
          label: `${s.name} · ${s.speciality}`,
        }))
      : (await managerApi.customers(company)).map((c) => ({
          value: c.email,
          label: `${c.name} · ${c.companies[0] ?? ""}`,
        }));

  return (
    <EmailCompose
      recipients={recipients}
      from="manager"
      // The switcher's company, so the mail is filed against the account the
      // reader is standing on rather than whichever came back first.
      companyId={company}
    />
  );
}
