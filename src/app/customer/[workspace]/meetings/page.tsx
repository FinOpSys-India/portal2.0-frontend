import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MeetingsAgenda, NextMeeting } from "@/components/portal/meetings-agenda";
import { NoManagerYet } from "@/components/portal/no-manager-yet";
import { PageHeader } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { customerApi } from "@/lib/customer";
import { ApiError } from "@/lib/http";
import { meetingsApi, meetingsEnabled, type Meeting } from "@/lib/meetings";

export const metadata: Metadata = { title: "Meetings" };

/** Meetings with this company's accounting manager. Reached from the icon beside the bell. */
export default async function CustomerMeetingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!meetingsEnabled()) notFound();
  const [{ workspace }, { tab }] = await Promise.all([params, searchParams]);

  const [manager, read] = await Promise.all([
    customerApi.manager(workspace),
    meetingsApi.list(workspace).then(
      (meetings): { meetings: Meeting[]; unavailable: boolean } => ({
        meetings,
        unavailable: false,
      }),
      (err) => {
        // Before the scheduler is deployed every meeting route is a 404.
        if (err instanceof ApiError && err.status === 404) {
          return { meetings: [], unavailable: true };
        }
        throw err;
      },
    ),
  ]);

  if (!manager.email) {
    return <NoManagerYet backHref={`/customer/${workspace}/projects`} />;
  }

  const base = `/customer/${workspace}/meetings`;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Meetings"
        description={`Meetings with ${manager.name}, your accounting manager.`}
        action={
          read.unavailable ? undefined : (
            <Button asChild>
              <Link href={`${base}/new`}>Request a Meeting</Link>
            </Button>
          )
        }
      />

      {read.unavailable ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Meetings aren’t available yet. Message your accounting manager in chat
          to find a time.
        </p>
      ) : (
        <>
          <NextMeeting meetings={read.meetings} />
          <MeetingsAgenda
            meetings={read.meetings}
            viewer="customer"
            showCompany={false}
            tab={tab === "past" ? "past" : "upcoming"}
          />
        </>
      )}
    </div>
  );
}
