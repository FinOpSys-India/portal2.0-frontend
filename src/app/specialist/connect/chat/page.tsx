import type { Metadata } from "next";

import { companyScope, specialistApi } from "@/lib/specialist";

import { ManagerChat } from "./manager-chat";

export const metadata: Metadata = { title: "Chat" };

/**
 * `?company=` is the header switcher's selection, and it decides WHICH thread
 * this is. A specialist works several companies, each with its own accounting
 * manager and its own conversation; without it every screen opened the first
 * company's thread and a message about any other one was invisible here.
 */
export default async function SpecialistChatPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const company = await companyScope((await searchParams).company);
  const thread = await specialistApi.thread(company);

  return (
    <ManagerChat
      contact={thread.contact}
      conversationId={thread.id}
      companyId={company}
    />
  );
}
