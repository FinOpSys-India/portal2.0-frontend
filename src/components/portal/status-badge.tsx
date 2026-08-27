import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/customer";
import { cn } from "@/lib/utils";

/**
 * Project status chip.
 *
 * Colours come from the deployed portal's tokens (--color-status-active-bg,
 * --color-status-inprogress-bg and their text pairs), so a status means the
 * same thing here as it does there.
 */
const STYLES: Record<ProjectStatus, string> = {
  "Not started": "bg-muted text-muted-foreground",
  "In progress": "bg-[#fef3c7] text-[#d97706]",
  Completed: "bg-[#dcfce7] text-[#16a34a]",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent font-medium", STYLES[status])}
    >
      {status}
    </Badge>
  );
}
