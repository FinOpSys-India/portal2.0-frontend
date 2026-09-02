import type { Metadata } from "next";

import { chatApi } from "@/lib/chat";
import { companyScope, scoped, type Party } from "@/lib/manager";

import { ChatInbox } from "./chat-inbox";

export const metadata: Metadata = { title: "Chat" };

/**
 * The chat inbox behind both Connect chat cards — 1.0 splits it across two
 * routes (`/am_chat_page`, `/am_chat_page_specialist`); the party rides in the
 * query instead, because the two screens differ only by which list they load.
 *
 * Two panes: threads on the left, the open thread on the right.
 */
export default async function ManagerChatPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; party?: string }>;
}) {
  const { company, party } = await searchParams;
  const forParty: Party = party === "specialist" ? "specialist" : "customer";

  /*
   * The contact lists are per company and there is no unscoped form — a roster
   * merged across companies would put two clients' people on one screen, which
   * is the same reason `companyId` is required everywhere else in chat.
   */
  const companyId = await companyScope(company);
  const contacts = companyId ? await chatApi.contacts(companyId, forParty) : [];

  return (
    <ChatInbox
      contacts={contacts}
      party={forParty}
      companyId={companyId}
      backHref={scoped("/manager/connect", companyId)}
    />
  );
}
