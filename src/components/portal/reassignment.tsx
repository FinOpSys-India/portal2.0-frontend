"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { EmptyFace, Face, splitInactive } from "@/components/portal/handover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REASSIGN_OPEN_EVENT, type Reassignment } from "@/lib/portal";

/**
 * The slot an Inactive person left (17 Nov): the control that names them,
 * still marked "(inactive)", followed by the Needs Reassignment badge.
 */
export function NeedsReassignment({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      <Badge variant="destructive">Needs Reassignment</Badge>
    </span>
  );
}

/** A banner over a company page that Needs Reassignment, with the control that fixes it. */
export function ReassignmentBanner({
  detail,
  children,
}: {
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300"
    >
      <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="font-medium">Needs Reassignment:</span> {detail}
      </span>
      {children}
    </div>
  );
}

const SEEN_KEY = "reassign-seen";

/**
 * Reassign Specialists (for an accounting manager) or Reassign Accounting
 * Managers (for admin), after sign-in and once per browser session until every
 * company is reassigned (17 Nov). A company that newly Needs Reassignment
 * shows it again: the key is the set of companies, not a flag.
 *
 * sessionStorage, not localStorage: a session is what "once per session" means,
 * and a closed tab should ask again. Wrapped, because private windows can throw.
 */
export function ReassignNotice({
  title,
  description,
  items,
  hrefBase,
}: {
  title: string;
  description: string;
  items: Reassignment[];
  /** The company page, minus its id: "/manager/companies/". */
  hrefBase: string;
}) {
  const key = items
    .map((r) => r.companyId)
    .sort()
    .join(",");
  // The server has no session to read, so it renders the popup closed.
  const seen = React.useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem(SEEN_KEY);
      } catch {
        return key;
      }
    },
    () => key,
  );
  const [dismissed, setDismissed] = React.useState<string | null>(null);
  // The bell's Needs Reassignment row asks for it back after "Later".
  const [recalled, setRecalled] = React.useState(false);
  React.useEffect(() => {
    const recall = () => setRecalled(true);
    window.addEventListener(REASSIGN_OPEN_EVENT, recall);
    return () => window.removeEventListener(REASSIGN_OPEN_EVENT, recall);
  }, []);
  const open =
    key !== "" && (recalled || (seen !== key && dismissed !== key));

  function close() {
    try {
      sessionStorage.setItem(SEEN_KEY, key);
    } catch {}
    setDismissed(key);
    setRecalled(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border">
          {items.map((r, i) => (
            <li
              key={r.companyId}
              // A short stagger, so the list reads as arriving row by row.
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
              className="flex items-center gap-3 px-4 py-3 motion-safe:animate-in motion-safe:fill-mode-backwards motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
            >
              {/* Who left → the empty slot: the popups' before → after, small. */}
              <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
                <span className="relative">
                  <Face
                    compact
                    name={splitInactive(r.people[0]?.name ?? r.company).name}
                    src={r.people[0]?.avatarUrl}
                    dimmed
                  />
                  {r.people.length > 1 ? (
                    <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-popover">
                      {r.people.length}
                    </span>
                  ) : null}
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <EmptyFace compact />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {r.company}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {r.detail}
                </span>
              </span>
              <Button asChild size="sm" variant="outline" onClick={close}>
                <Link href={hrefBase + r.companyId}>Reassign</Link>
              </Button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
