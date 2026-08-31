import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerShell } from "@/components/manager/manager-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { managerApi, totalUnread } from "@/lib/manager";

export const metadata: Metadata = {
  title: { default: "Manager – FinOpSys", template: "%s – Manager – FinOpSys" },
};

/**
 * The unread count, off the critical path.
 *
 * `conversations()` sweeps every company this manager holds — eight requests,
 * each of which re-authenticates and re-checks access before it reads anything.
 * Awaited in the layout it delayed the entire frame, nav included, to put one
 * number on the bell. Behind a boundary it arrives whenever it arrives and the
 * bell simply starts at zero.
 */
async function UnreadBell() {
  const conversations = await managerApi.conversations();
  return <NotificationBell count={totalUnread(conversations)} />;
}

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only what the frame cannot be drawn without: the reader's name for the
  // account menu, and the companies for the switcher.
  const [profile, companies] = await Promise.all([
    managerApi.profile(),
    managerApi.companies(),
  ]);

  return (
    <ManagerShell
      user={{ name: profile.name, email: profile.email }}
      companies={companies.map(({ id, name }) => ({ id, name }))}
      notifications={
        <Suspense fallback={<NotificationBell count={0} />}>
          <UnreadBell />
        </Suspense>
      }
    >
      {children}
    </ManagerShell>
  );
}
