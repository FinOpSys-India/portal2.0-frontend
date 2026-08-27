import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerShell } from "@/components/customer/customer-shell";
import { chatApi } from "@/lib/chat";
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
  const [workspaces, profile, unread] = await Promise.all([
    customerApi.workspaces(),
    customerApi.profile(),
    /*
     * The bell was the only one of the four portals wired to nothing: the prop
     * defaults to 0 and the layout never passed it, so a customer had no way to
     * learn their manager had written until they opened Connect and looked.
     *
     * `GET /chat/unread-count` is the endpoint for exactly this and nothing
     * called it. Swallowed rather than awaited hard — a chat gate (an unpaid
     * account 402s here) must not take the whole portal frame down with it.
     */
    chatApi.unreadCount(id).catch(() => 0),
  ]);
  const workspace = workspaces.find((w) => w.id === id);

  // An unknown workspace is a 404, not an empty portal — otherwise a typo in
  // the URL renders a working-looking page with nobody's data in it.
  if (!workspace) notFound();

  return (
    <CustomerShell
      workspace={workspace}
      workspaces={workspaces}
      user={{ name: profile.fullName, email: profile.email }}
      notificationCount={unread}
    >
      {children}
    </CustomerShell>
  );
}
