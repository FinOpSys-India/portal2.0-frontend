import type { Metadata } from "next";
import { Suspense } from "react";

import { ManagerShell } from "@/components/manager/manager-shell";
import { MeetingsLink } from "@/components/portal/meetings-link";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { ReassignNotice } from "@/components/portal/reassignment";
import { dayLabel, managerApi, unreadConversations } from "@/lib/manager";
import { groupMeetings, meetingsApi, meetingsEnabled } from "@/lib/meetings";
import { reassignmentNotifications } from "@/lib/portal";

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
  const [conversations, pending] = await Promise.all([
    managerApi.conversations().catch(() => []),
    managerApi.reassignments().catch(() => []),
  ]);

  return (
    <NotificationBell
      items={[
        // Needs Reassignment first (17 Nov): it is work, not a message.
        ...reassignmentNotifications(pending, "specialist"),
        ...unreadConversations(conversations).map((c) => ({
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
        })),
      ]}
    />
  );
}

/**
 * The Meetings icon's number: requests across every company that wait on this
 * manager. The same company sweep as the bell, behind its own boundary and
 * swallowed for the same reasons — a count nobody can read is zero.
 */
async function MeetingsBadge() {
  const { meetings } = await meetingsApi
    .listAll()
    .catch(() => ({ meetings: [] }));
  return (
    <MeetingsLink
      href="/manager/meetings"
      count={groupMeetings(meetings, "manager").needsReply.length}
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
  const [profile, companies, reassignments] = await Promise.all([
    managerApi.profile(),
    managerApi.companies(),
    // Built from the same cached company rows, so no extra request.
    managerApi.reassignments().catch(() => []),
  ]);

  return (
    <ManagerShell
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
      // Inactive companies are frozen (16 Nov): off the switcher, name kept
      // on the Companies list.
      companies={companies
        .filter((c) => !c.inactive)
        .map(({ id, name }) => ({ id, name }))}
      notifications={
        <Suspense fallback={<NotificationBell />}>
          <UnreadBell />
        </Suspense>
      }
      meetings={
        meetingsEnabled() ? (
          <Suspense
            fallback={<MeetingsLink href="/manager/meetings" count={0} />}
          >
            <MeetingsBadge />
          </Suspense>
        ) : undefined
      }
    >
      <ReassignNotice
        title="Reassign Specialists"
        description="A specialist on these companies is inactive. Choose a new specialist for each service; the company’s open projects move to them."
        items={reassignments}
        hrefBase="/manager/companies/"
      />
      {children}
    </ManagerShell>
  );
}
