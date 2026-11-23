import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";

import { ConnectCard } from "@/components/portal/connect-card";
import {
  companyScope,
  managerApi,
  totalUnread,
  type Party,
} from "@/lib/manager";

export const metadata: Metadata = { title: "Connect" };

/**
 * The Connect hub, as 1.0 lays it out: two sections — customers and
 * specialists — each opening /manager/connect/chat with its ?party=. Email,
 * 1.0's second channel, was dropped on 4 Nov 2026; chat is the only one.
 */
const SECTIONS: {
  party: Party;
  title: string;
  blurb: string;
  chat: string;
}[] = [
  {
    party: "customer",
    title: "Connect with Your Customer",
    blurb:
      "Keep your customers in the loop with quick updates, detailed communication, and document sharing.",
    chat: "Chat with Customer",
  },
  {
    party: "specialist",
    title: "Connect with Your Specialist",
    blurb:
      "Reach your specialist via chat for quick updates, document sharing, and case support.",
    chat: "Chat with Specialist",
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

  const unreadFor = (party: Party) =>
    totalUnread(conversations.filter((c) => c.party === party));

  const href = (party: Party) => {
    const search = new URLSearchParams();
    if (company) search.set("company", company);
    search.set("party", party);
    return `/manager/connect/chat?${search}`;
  };

  return (
    <div className="grid gap-6">
      {/* The hub draws two equal sections and no title above them, so its
          heading outline started at h2. sr-only rather than a visible title:
          the design has no room for one, and the customer and specialist hubs
          — which have a single section — already carry the h1 in that
          section's own heading. */}
      <h1 className="sr-only">Connect</h1>

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
              href={href(section.party)}
              unread={unreadFor(section.party)}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
