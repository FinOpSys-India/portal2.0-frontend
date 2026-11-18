import Link from "next/link";

import { cn } from "@/lib/utils";
import { PROJECT_TABS, projectTab, type ProjectTab } from "@/lib/portal";

/**
 * Active · Completed · Inactive over a Projects list, each with its count.
 *
 * Links, not client state: the tab rides in `?tab=` so a shared link or the
 * back button lands on the same tab. `href` builds each link, so a portal can
 * keep its own `?company=` scope on it. Switching tab drops page and filters —
 * page 3 of Active means nothing on Completed.
 */
export function ProjectTabs({
  current,
  projects,
  href,
}: {
  current: ProjectTab;
  projects: { status: string; inactive: boolean }[];
  href: (tab: ProjectTab) => string;
}) {
  return (
    <nav aria-label="Project status" className="flex gap-1 border-b border-border">
      {PROJECT_TABS.map(({ tab, label }) => {
        const count = projects.filter((p) => projectTab(p) === tab).length;
        const active = tab === current;
        return (
          <Link
            key={tab}
            href={href(tab)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
