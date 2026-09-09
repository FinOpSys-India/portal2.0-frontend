import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerShell } from "@/components/manager/manager-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { managerApi, newestUnread, totalUnread } from "@/lib/manager";

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
  /*
   * Swallowed, not awaited hard. Suspense covers SLOW, not FAILED: an
   * unhandled throw in here escapes the boundary and the route's error.tsx
   * replaces the whole page. That is what turned one 504 on the eight-company
   * conversation sweep into "Something went wrong" on /manager/projects/:id,
   * whose own project, task and document reads had all returned 200. A count
   * nobody can read is worth zero, so it renders zero.
   */
  const conversations = await managerApi.conversations().catch(() => []);
  const open = newestUnread(conversations);

  /*
   * The bell is a link to the thread it is counting. A manager holds several
   * companies and several people per company, so "you have 3 unread" without a
   * destination is a scavenger hunt: chat is scoped by company AND by side of
   * the account, so the reader would have to guess both before finding the
   * message. All three land in the query the inbox already reads.
   */
  return (
    <NotificationBell
      count={totalUnread(conversations)}
      href={
        open
          ? `/manager/connect/chat?company=${encodeURIComponent(open.companyId)}&party=${open.party}&conversation=${encodeURIComponent(open.id)}`
          : "/manager/connect"
      }
    />
  );
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
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
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
