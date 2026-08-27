import type { Metadata } from "next";

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

  return (
    <ManagerChat
      workspace={workspace}
      contact={thread.contact}
      conversationId={thread.id}
    />
  );
}
