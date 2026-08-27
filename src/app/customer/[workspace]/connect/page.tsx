import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";

import { ConnectCard } from "@/components/portal/connect-card";
import { customerApi } from "@/lib/customer";

export const metadata: Metadata = { title: "Connect" };

/**
 * The Connect hub. One section, not the manager's two: a customer's accounting
 * manager is their single point of contact, so there is no party to choose
 * before choosing a channel.
 */
export default async function CustomerConnectPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const thread = await customerApi.thread(workspace);

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
          label={`Chat with ${thread.contact}`}
          action="Start Chat"
          href={`/customer/${workspace}/connect/chat`}
          unread={thread.unread}
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
