import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";

import { ConnectCard } from "@/components/portal/connect-card";
import { companyScope, managerApi, totalUnread, type Party } from "@/lib/manager";

export const metadata: Metadata = { title: "Connect" };

/**
 * The Connect hub, as 1.0 lays it out: two sections — customers and
 * specialists — each offering chat and email.
 *
 * The four cards lead to /manager/connect/chat and /manager/connect/email,
 * each carrying ?party=. 1.0 has four separate routes for the same four
 * destinations; chat opens a thread list, email opens a blank compose form.
 */
const SECTIONS: {
  party: Party;
  title: string;
  blurb: string;
  chat: string;
  email: string;
}[] = [
  {
    party: "customer",
    title: "Connect With Your Customer",
    blurb:
      "Keep your customers in the loop. Chat for quick updates or email for detailed communication and document sharing.",
    chat: "Chat with customer",
    email: "Email to customer",
  },
  {
    party: "specialist",
    title: "Connect With Your Specialist",
    blurb:
      "Reach your specialist via chat or email for quick updates, document sharing, and case support.",
    chat: "Chat with specialist",
    email: "Email to specialist",
  },
];

export default async function ManagerConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const company = await companyScope((await searchParams).company);
  const conversations = await managerApi.conversations(
    company ? { companyId: company } : {},
  );

  const unreadFor = (party: Party, channel: "chat" | "email") =>
    totalUnread(
      conversations.filter((c) => c.party === party && c.channel === channel),
    );

  const href = (channel: string, party: Party) => {
    const search = new URLSearchParams();
    if (company) search.set("company", company);
    search.set("party", party);
    return `/manager/connect/${channel}?${search}`;
  };

  return (
    <div className="grid gap-6">
      {SECTIONS.map((section) => (
        <section
          key={section.party}
          className="rounded-xl border border-border bg-card px-6 py-10"
        >
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              {section.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {section.blurb}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-6">
            <ConnectCard
              icon={<MessageSquare className="size-10" aria-hidden />}
              label={section.chat}
              action="Start Chat"
              href={href("chat", section.party)}
              unread={unreadFor(section.party, "chat")}
            />
            {/* No count on email: the card opens a blank compose form, and
                1.0 has no inbox to read a reply in. A badge here would point
                at nothing. */}
            <ConnectCard
              icon={<Mail className="size-10" aria-hidden />}
              label={section.email}
              action="Send Email"
              href={href("email", section.party)}
              unread={0}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
