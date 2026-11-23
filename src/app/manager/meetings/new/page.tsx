import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { BookingView, type Invitee } from "@/components/portal/booking-view";
import { PageHeader } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { chatApi } from "@/lib/chat";
import { managerApi } from "@/lib/manager";
import { meetingsApi, meetingsEnabled } from "@/lib/meetings";

export const metadata: Metadata = { title: "Schedule a Meeting" };

/**
 * Schedule a meeting with someone on the customer side of any company this
 * manager holds. Arrives prefilled from chat (`company`, `with`), from the
 * calendar (`date`, `time`) and from Cancel and Schedule New (`title`,
 * `description`).
 */
export default async function ScheduleMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    with?: string;
    title?: string;
    description?: string;
    date?: string;
    time?: string;
  }>;
}) {
  if (!meetingsEnabled()) notFound();
  const q = await searchParams;

  const companies = (await managerApi.companies()).filter((c) => !c.inactive);
  const [people, microsoft] = await Promise.all([
    Promise.all(
      companies.map((c) =>
        chatApi
          .contacts(c.id, "customer")
          // A company that refuses (unpaid) offers nobody, not an error page.
          .catch(() => [])
          .then((contacts): Invitee[] =>
            contacts
              .filter((p) => p.email)
              .map((p) => ({
                userId: p.userId,
                name: p.name,
                email: p.email!,
                companyId: c.id,
                companyName: c.name,
              })),
          ),
      ),
    ).then((pages) => pages.flat()),
    meetingsApi.microsoftStatus().catch(() => null),
  ]);

  const withUserId = Number(q.with);

  return (
    <div className="grid gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/manager/meetings">
          <ChevronLeft aria-hidden />
          Back to Meetings
        </Link>
      </Button>
      <PageHeader
        title="Schedule a Meeting"
        description="Choose who, then a day and a time. They get the invitation by email and a meeting card in chat."
      />
      <BookingView
        mode="schedule"
        people={people}
        microsoft={microsoft}
        initial={{
          companyId: q.company,
          withUserId: Number.isInteger(withUserId) ? withUserId : undefined,
          title: q.title?.slice(0, 200),
          description: q.description?.slice(0, 5000),
          date: /^\d{4}-\d{2}-\d{2}$/.test(q.date ?? "") ? q.date : undefined,
          time: /^\d{2}:\d{2}$/.test(q.time ?? "") ? q.time : undefined,
        }}
      />
    </div>
  );
}
