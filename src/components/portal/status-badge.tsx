import { ChevronDown } from "lucide-react";

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

export function StatusBadge({
  status,
  chevron = false,
}: {
  status: ProjectStatus;
  /**
   * Marks the chip as a control rather than a label.
   *
   * The same pill reports a status the reader cannot touch and opens the menu
   * that changes it, and nothing told those two apart — a customer and a
   * specialist saw an identical chip, one of them clickable. The caret is the
   * affordance every other menu in the portal already carries (the switcher
   * pill, Export CSV), so it is the one borrowed here.
   *
   * Inside the pill, not beside it: a caret floating next to a chip reads as
   * belonging to the column, not to the chip.
   */
  chevron?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent font-medium", STYLES[status])}
    >
      {status}
      {chevron ? <ChevronDown className="size-3 shrink-0" aria-hidden /> : null}
    </Badge>
  );
}
