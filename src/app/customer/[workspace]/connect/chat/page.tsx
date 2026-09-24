import type { Metadata } from "next";

import { NoManagerYet } from "@/components/portal/no-manager-yet";
import { customerApi } from "@/lib/customer";

import { ManagerChat } from "./manager-chat";

export const metadata: Metadata = { title: "Chat" };

export default async function CustomerChatPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const thread = await customerApi.thread(workspace);

  // No thread until the company is staffed — see `openThread`.
  if (!thread.id) {
    return <NoManagerYet backHref={`/customer/${workspace}/connect`} />;
  }

  return (
    <ManagerChat
      workspace={workspace}
      contact={thread.contact}
      contactAvatarUrl={thread.contactAvatarUrl}
      conversationId={thread.id}
    />
  );
}
