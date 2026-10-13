import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/customer";
import { isOverdue } from "@/lib/manager";

/**
 * A deadline, and whether it has been missed.
 *
 * One component for the three project tables, the three detail panels and the
 * task tables under them, so late work looks late in every place it is named —
 * a manager, its specialist and the customer all read the same flag, rather
 * than the manager's table being the only screen that says anything.
 *
 * Tasks run the same rule because they are the same question: `isOverdue` takes
 * a deadline and a status, and a task's three states are a project's three
 * states. A task due last week with its status still open is exactly as late as
 * a project would be, and said the same way.
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
