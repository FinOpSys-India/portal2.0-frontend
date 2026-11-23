"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The Meetings icon, beside the bell in both portals' top bars (Siddharth,
 * 22 Nov: its own icon, not a sidebar row). The number is what waits on the
 * reader: requests to answer for the manager, invitations for the customer.
 * Drawn like the bell so the two read as one group.
 */
export function MeetingsLink({ href, count }: { href: string; count: number }) {
  const pathname = usePathname();
  const here = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={here ? "page" : undefined}
      aria-label={
        count > 0 ? `Meetings, ${count} waiting for you` : "Meetings"
      }
      className={cn(
        "relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
        here && "bg-accent text-primary",
      )}
    >
      <CalendarDays className="size-5" aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
