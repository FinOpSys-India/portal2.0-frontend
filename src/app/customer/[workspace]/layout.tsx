import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerShell } from "@/components/customer/customer-shell";
import { LiveBell } from "@/components/portal/live-bell";
import { api } from "@/lib/api";
import { customerApi } from "@/lib/customer";

export const metadata: Metadata = {
  title: { default: "FinOpSys", template: "%s – FinOpSys" },
};

export default async function CustomerLayout({
  params,
  children,
}: {
  params: Promise<{ workspace: string }>;
  children: React.ReactNode;
}) {
  const { workspace: id } = await params;
  // Only what the frame cannot be drawn without. The bell is one request per
  // workspace and hangs off its own boundary below, because a chat gate (an
  // unpaid account 402s there) must not take the whole portal frame down.
  // `/companies/owned` filters on `ownerUserId`, so a teammate matches nothing
  // and loses the owner-only nav rows. It fails closed on error for the same
  // reason the bell does: a frame that renders beats a frame that throws.
  const [workspaces, profile, owned] = await Promise.all([
    customerApi.workspaces(),
    customerApi.profile(),
    api.ownedCompanies().catch(() => []),
  ]);
  const workspace = workspaces.find((w) => w.id === id);

  // An unknown workspace is a 404, not an empty portal — otherwise a typo in
  // the URL renders a working-looking page with nobody's data in it.
  if (!workspace) notFound();

  return (
    <CustomerShell
      workspace={workspace}
      workspaces={workspaces}
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
      owner={owned.some((c) => String(c.companyId) === id)}
      // A client component, so it mounts once and survives every navigation
      // under this layout instead of sweeping again on each one. See LiveBell.
      notifications={<LiveBell companies={workspaces} hrefFor="customer" />}
    >
      {children}
    </CustomerShell>
  );
}
