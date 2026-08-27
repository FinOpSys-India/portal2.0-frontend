import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * One channel tile on a Connect hub — an icon well, the channel name, and the
 * action that opens it.
 *
 * 1.0 shows no unread count here. Surfacing it turns a decorative tile into
 * something worth clicking first; pass 0 where there is no inbox to read a
 * reply in, because a badge there would point at nothing.
 */
export function ConnectCard({
  icon,
  label,
  action,
  href,
  unread,
}: {
  icon: React.ReactNode;
  label: string;
  action: string;
  href: string;
  unread: number;
}) {
  return (
    <div className="w-full max-w-72 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative grid h-40 place-items-center bg-primary/8 text-primary">
        {icon}
        {unread > 0 ? (
          <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold tabular-nums text-primary-foreground">
            {unread}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 p-4">
        <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
        <Button asChild size="sm">
          <Link href={href}>{action}</Link>
        </Button>
      </div>
    </div>
  );
}
