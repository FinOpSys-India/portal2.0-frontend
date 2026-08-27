import type { Metadata } from "next";

import { EmailCompose } from "@/components/portal/email-compose";
import { specialistApi } from "@/lib/specialist";

export const metadata: Metadata = { title: "Email" };

/**
 * Compose. The manager's version opens with a recipient dropdown; here the
 * recipient is a chip, because a specialist has one counterparty and a select
 * of one is a control that cannot be used.
 */
export default async function SpecialistEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const [{ company }, manager] = await Promise.all([
    searchParams,
    specialistApi.manager(),
  ]);

  return (
    <EmailCompose
      from="specialist"
      companyId={company}
      fixedTo={{
        value: manager.email,
        label: `${manager.name} · ${manager.email}`,
      }}
    />
  );
}
