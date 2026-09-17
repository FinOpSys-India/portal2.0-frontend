import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/customer";
import { isOverdue } from "@/lib/manager";

/**
 * A project's deadline, and whether it has been missed.
 *
 * One component for the three project tables and the three detail panels, so a
 * late project looks late in every place it is named — a manager, its
 * specialist and the customer all read the same flag, rather than the manager's
 * table being the only screen that says anything.
 *
 * The chip carries the word, not just the colour: red text alone is not a
 * label for anyone who cannot see red, and the deadline tables sort by date
 * rather than by lateness, so a reader scanning the column needs it spelled.
 */
export function ProjectDeadline({
  deadline,
  status,
}: {
  deadline: string;
  status: ProjectStatus;
}) {
  // Matches DetailRow's rule for an empty field: visibly missing, not a gap.
  if (!deadline.trim())
    return <span className="font-normal text-muted-foreground">—</span>;

  if (!isOverdue({ deadline, status }))
    return <span className="tabular-nums">{deadline}</span>;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="font-medium text-destructive tabular-nums">
        {deadline}
      </span>
      <Badge variant="destructive">Overdue</Badge>
    </span>
  );
}
