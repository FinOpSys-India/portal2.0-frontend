import type { Metadata } from "next";

import { ManagerShell } from "@/components/manager/manager-shell";
import { managerApi, totalUnread } from "@/lib/manager";

export const metadata: Metadata = {
  title: { default: "Manager – FinOpSys", template: "%s – Manager – FinOpSys" },
};

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, conversations, companies] = await Promise.all([
    managerApi.profile(),
    managerApi.conversations(),
    managerApi.companies(),
  ]);

  return (
    <ManagerShell
      user={{ name: profile.name, email: profile.email }}
      companies={companies.map(({ id, name }) => ({ id, name }))}
      // The bell now has a real number behind it: unread client messages.
      notificationCount={totalUnread(conversations)}
    >
      {children}
    </ManagerShell>
  );
}
