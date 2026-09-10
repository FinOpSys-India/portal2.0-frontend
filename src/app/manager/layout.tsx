import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerShell } from "@/components/manager/manager-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { dayLabel, managerApi, unreadConversations } from "@/lib/manager";

export const metadata: Metadata = {
  title: { default: "Manager – FinOpSys", template: "%s – Manager – FinOpSys" },
};

/**
 * The bell's list, off the critical path.
 *
 * `conversations()` sweeps every company this manager holds — eight requests,
 * each of which re-authenticates and re-checks access before it reads anything.
 * Awaited in the layout it delayed the entire frame, nav included, to fill one
 * dropdown. Behind a boundary it arrives whenever it arrives and the bell simply
 * starts empty.
 */
async function UnreadBell() {
  /*
   * Swallowed, not awaited hard. Suspense covers SLOW, not FAILED: an
   * unhandled throw in here escapes the boundary and the route's error.tsx
   * replaces the whole page. That is what turned one 504 on the eight-company
   * conversation sweep into "Something went wrong" on /manager/projects/:id,
   * whose own project, task and document reads had all returned 200. A list
   * nobody can read is worth zero, so it renders empty.
   */
  const conversations = await managerApi.conversations().catch(() => []);

  return (
    <NotificationBell
      items={unreadConversations(conversations).map((c) => ({
        id: c.id,
        /*
         * Company AND party AND thread. The manager's inbox is scoped by both —
         * `/chat/contacts/...` is per company and per side of the account — so a
         * link carrying less than all three lands on a roster the message is not
         * in. The inbox reads `?conversation=` and opens that row.
         */
        href: `/manager/connect/chat?company=${encodeURIComponent(c.companyId)}&party=${c.party}&conversation=${encodeURIComponent(c.id)}`,
        company: c.company,
        contact: c.contact,
        preview: c.lastMessage,
        unread: c.unread,
        when: c.lastMessageAt ? dayLabel(c.lastMessageAt) : "",
      }))}
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
        <Suspense fallback={<NotificationBell />}>
          <UnreadBell />
        </Suspense>
      }
    >
      {children}
    </ManagerShell>
  );
}
