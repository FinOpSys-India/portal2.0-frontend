import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  MicrosoftConnection,
  MicrosoftReturn,
} from "@/components/portal/microsoft-connection";
import { PageHeader } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { managerApi } from "@/lib/manager";
import { meetingsApi, meetingsEnabled } from "@/lib/meetings";

import { ManagerMeetings } from "./manager-meetings";

export const metadata: Metadata = { title: "Meetings" };

/**
 * Every meeting with the manager's customers, across their companies. Reached
 * from the icon beside the bell, not from the sidebar (Siddharth, 22 Nov).
 */
export default async function ManagerMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tab?: string }>;
}) {
  if (!meetingsEnabled()) notFound();
  const { view, tab } = await searchParams;

  const [read, companies, microsoft] = await Promise.all([
    meetingsApi.listAll(),
    managerApi.companies(),
    meetingsApi.microsoftStatus().catch(() => null),
  ]);

  return (
    <div className="grid gap-6">
      <Suspense>
        <MicrosoftReturn />
      </Suspense>
      <PageHeader
        title="Meetings"
        description="Every meeting with your customers, across your companies."
        action={
          read.unavailable ? undefined : (
            <Button asChild>
              <Link href="/manager/meetings/new">Schedule a Meeting</Link>
            </Button>
          )
        }
      />

      <MicrosoftConnection status={microsoft} />

      {read.unavailable ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Meetings aren’t available yet. They appear here once the server
          supports them.
        </p>
      ) : (
        <ManagerMeetings
          meetings={read.meetings}
          companies={companies
            .filter((c) => !c.inactive)
            .map(({ id, name }) => ({ id, name }))}
          view={view === "calendar" ? "calendar" : "list"}
          tab={tab === "past" ? "past" : "upcoming"}
        />
      )}
    </div>
  );
}
