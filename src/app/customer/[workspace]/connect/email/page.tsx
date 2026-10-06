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

  /*
   * A company can sit without an accounting manager — assignment is a separate
   * admin step after signup, and `companyDto` simply sends no joined person.
   *
   * Withholding `fixedTo` rather than passing an empty one is what makes the
   * screen honest: the chip used to render as a bare " · " and Send stayed
   * live, so the one action here posted an empty recipient and failed at the
   * API. With no recipient the composer already draws "Nobody to write to" and
   * disables Send; the line below says why, which the placeholder cannot.
   *
   * The line names chat too because it is in the same state: `openThread`
   * takes a 409 NO_ACCOUNTING_MANAGER and renders an empty thread, so sending
   * a customer there would be sending them nowhere.
   */
  const unassigned = !manager.email;

  return (
    <>
      <EmailCompose
        from="customer"
        companyId={workspace}
        fixedTo={
          unassigned
            ? undefined
            : {
                value: manager.email,
                label: `${manager.name} · ${manager.email}`,
              }
        }
      />

      {unassigned ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          No accounting manager is attached to this company yet, so there is
          nobody to email. Chat is unavailable for the same reason until one is
          assigned.
        </p>
      ) : null}
    </>
  );
}
