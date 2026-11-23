"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CalendarDays, List } from "lucide-react";

import { MeetingsAgenda, type AgendaTab } from "@/components/portal/meetings-agenda";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Meeting } from "@/lib/meetings";
import { cn } from "@/lib/utils";

export type MeetingsView = "list" | "calendar";

/*
 * The calendar's code loads only when someone opens it. It draws in the
 * browser anyway (its days are the reader's own), so there is nothing for the
 * server to render; the placeholder holds its space so nothing shifts.
 */
const MeetingsCalendar = dynamic(
  () => import("@/components/portal/meetings-calendar").then((m) => m.MeetingsCalendar),
  {
    ssr: false,
    loading: () => <div aria-hidden className="h-[640px] w-full animate-pulse rounded-xl bg-muted" />,
  },
);

/**
 * The manager's meetings across every company, with its own Company filter.
 *
 * NOT the header switcher's scope, deliberately. The switcher has no "All
 * Companies" entry and `ScopeMemory` writes the last company back into every
 * URL, so a page that followed it could never show the whole book — and a
 * request waiting on one company must not hide while the manager is looking
 * at another (Siddharth, 22 Nov). The filter lives in this page only.
 */
export function ManagerMeetings({
  meetings,
  companies,
  view: initialView,
  tab,
}: {
  meetings: Meeting[];
  companies: { id: string; name: string }[];
  /** From `?view=`, so a reloaded or shared address opens the same view. */
  view: MeetingsView;
  tab: AgendaTab;
}) {
  const [company, setCompany] = React.useState("all");
  const shown =
    company === "all" ? meetings : meetings.filter((m) => m.companyId === company);

  // Switched in the browser: both views draw the meetings already here, so a
  // round trip would re-read every company for nothing. The address follows.
  const [view, setView] = React.useState(initialView);
  const pickView = (next: MeetingsView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "calendar") url.searchParams.set("view", "calendar");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Label htmlFor="meetings-company">Company</Label>
          <Select value={company} onValueChange={setCompany}>
            <SelectTrigger id="meetings-company" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div role="group" aria-label="Meetings view" className="flex rounded-lg border border-border p-0.5">
          {(
            [
              ["list", "List", List],
              ["calendar", "Calendar", CalendarDays],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => pickView(key)}
              aria-pressed={view === key}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                view === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "calendar" ? (
        <MeetingsCalendar meetings={shown} />
      ) : (
        <MeetingsAgenda
          meetings={shown}
          viewer="manager"
          showCompany={company === "all"}
          tab={tab}
        />
      )}
    </div>
  );
}
