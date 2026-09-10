import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CustomerShell } from "@/components/customer/customer-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { unreadThreads } from "@/lib/chat";
import { dayLabel } from "@/lib/manager";
import { customerApi, type Workspace } from "@/lib/customer";

export const metadata: Metadata = {
  title: { default: "FinOpSys", template: "%s – FinOpSys" },
};

/**
 * Every workspace, not just the open one.
 *
 * The bell was wired to `GET /chat/unread-count` for the CURRENT workspace, so a
 * customer who owns two companies had no way to learn their other manager had
 * written until they switched to it. Each row carries its company, and clicking
 * one crosses into that workspace's chat.
 */
async function UnreadBell({ workspaces }: { workspaces: Workspace[] }) {
  const threads = await unreadThreads(workspaces).catch(() => []);

  return (
    <NotificationBell
      items={threads.map((t) => ({
        id: t.conversationId,
        // The workspace IS the company id, and it rides in the path here.
        href: `/customer/${encodeURIComponent(t.companyId)}/connect/chat`,
        company: t.company,
        contact: t.contact,
        preview: t.preview,
        unread: t.unread,
        when: t.at ? dayLabel(t.at) : "",
      }))}
    />
  );
}

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
  const [workspaces, profile] = await Promise.all([
    customerApi.workspaces(),
    customerApi.profile(),
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
      notifications={
        <Suspense fallback={<NotificationBell />}>
          <UnreadBell workspaces={workspaces} />
        </Suspense>
      }
    >
      {children}
    </CustomerShell>
  );
}
