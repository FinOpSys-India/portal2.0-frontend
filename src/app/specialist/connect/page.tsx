import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";

import { ConnectCard } from "@/components/portal/connect-card";
import { scoped } from "@/lib/manager";
import { specialistApi } from "@/lib/specialist";

export const metadata: Metadata = { title: "Connect" };

/**
 * The Connect hub. One section, not the manager's two: a specialist has a
 * single counterparty — their accounting manager — so there is no party to
 * choose before choosing a channel.
 */
export default async function SpecialistConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  // Scoped, so the card names the manager of the company on the switcher and
  // its badge counts that thread — not whichever company came back first.
  const thread = await specialistApi.thread(company);

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-10">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Connect With Your Accounting Manager
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Chat for quick updates, or email for detailed communication and
          document sharing.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-6">
        <ConnectCard
          icon={<MessageSquare className="size-10" aria-hidden />}
          label={`Chat with ${thread.contact}`}
          action="Start Chat"
          href={scoped("/specialist/connect/chat", company)}
          unread={thread.unread}
        />
        {/* No count on email: the card opens a blank compose form, and there is
            no inbox to read a reply in. A badge here would point at nothing. */}
        <ConnectCard
          icon={<Mail className="size-10" aria-hidden />}
          label="Email your manager"
          action="Send Email"
          href={scoped("/specialist/connect/email", company)}
          unread={0}
        />
      </div>
    </section>
  );
}
