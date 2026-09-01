import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";

import { ConnectCard } from "@/components/portal/connect-card";
import { chatApi } from "@/lib/chat";
import { customerApi } from "@/lib/customer";

export const metadata: Metadata = { title: "Connect" };

/**
 * The Connect hub. One section, not the manager's two: a customer's accounting
 * manager is their single point of contact, so there is no party to choose
 * before choosing a channel.
 *
 * TWO READS, NOT `thread()`. This page renders a name and a badge over two
 * links, and it used to get both from `POST /chat/conversations` — a WRITE, on
 * a render, costing sixteen round trips to a database on another continent.
 * That is 5-9s against a backend function capped at 10, so the row was opened
 * and the answer arrived too late to render: the page showed "Something went
 * wrong" over a conversation that had just been created successfully. The
 * conversation belongs to /connect/chat, which needs its id; here it was
 * paying to learn a name the company record already carries.
 */
export default async function CustomerConnectPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [manager, unread] = await Promise.all([
    customerApi.manager(workspace),
    // The badge is not the page: a chat gate refusing must not take the hub
    // down with it. The layout reads the same count for the bell, so this is a
    // repeat of a request already on this render and cached for the next.
    chatApi.unreadCount(workspace).catch(() => 0),
  ]);

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-10">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Connect With Your Accounting Manager
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a conversation with your accounting team through chat or email
          for support, updates, and document sharing.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-6">
        <ConnectCard
          icon={<MessageSquare className="size-10" aria-hidden />}
          // Named only when the company has one staffed; `personName` answers
          // "" otherwise, and "Chat with" trailing into nothing reads as a bug.
          label={`Chat with ${manager.name || "your accounting manager"}`}
          action="Start Chat"
          href={`/customer/${workspace}/connect/chat`}
          unread={unread}
        />
        {/* No count on email: the card opens a blank compose form, and there is
            no inbox to read a reply in. A badge here would point at nothing. */}
        <ConnectCard
          icon={<Mail className="size-10" aria-hidden />}
          label="Email your manager"
          action="Send Email"
          href={`/customer/${workspace}/connect/email`}
          unread={0}
        />
      </div>
    </section>
  );
}
