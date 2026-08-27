import type { Metadata } from "next";

import { EmailCompose } from "@/components/portal/email-compose";
import { customerApi } from "@/lib/customer";

export const metadata: Metadata = { title: "Email" };

/**
 * Compose. The manager's version opens with a recipient dropdown; here the
 * recipient is a chip, because a customer writes to their accounting manager
 * and a select of one is a control that cannot be used.
 */
export default async function CustomerEmailPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const manager = await customerApi.manager(workspace);

  return (
    <EmailCompose
      from="customer"
      companyId={workspace}
      fixedTo={{
        value: manager.email,
        label: `${manager.name} · ${manager.email}`,
      }}
    />
  );
}
