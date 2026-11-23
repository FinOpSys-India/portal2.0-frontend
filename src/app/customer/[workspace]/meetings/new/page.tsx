import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { BookingView } from "@/components/portal/booking-view";
import { NoManagerYet } from "@/components/portal/no-manager-yet";
import { PageHeader } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { customerApi } from "@/lib/customer";
import { meetingsEnabled } from "@/lib/meetings";

export const metadata: Metadata = { title: "Request a Meeting" };

/** Ask this company's accounting manager for one of their free times. */
export default async function RequestMeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ title?: string; description?: string }>;
}) {
  if (!meetingsEnabled()) notFound();
  const [{ workspace }, q] = await Promise.all([params, searchParams]);
  const manager = await customerApi.manager(workspace);

  if (!manager.email) {
    return <NoManagerYet backHref={`/customer/${workspace}/meetings`} />;
  }

  return (
    <div className="grid gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href={`/customer/${workspace}/meetings`}>
          <ChevronLeft aria-hidden />
          Back to Meetings
        </Link>
      </Button>
      <PageHeader
        title="Request a Meeting"
        description={`Pick a day and one of the free times. ${manager.name} confirms it.`}
      />
      <BookingView
        mode="request"
        companyId={workspace}
        manager={{ name: manager.name, email: manager.email }}
        initial={{
          title: q.title?.slice(0, 200),
          description: q.description?.slice(0, 5000),
        }}
      />
    </div>
  );
}
