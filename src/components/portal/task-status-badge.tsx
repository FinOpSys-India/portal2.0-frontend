import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/lib/manager";
import { cn } from "@/lib/utils";

/** 1.0's three task states, in 1.0's colours: amber in flight, green done. */
const TONE: Record<TaskStatus, string> = {
  "To do": "bg-[#fef3c7] text-[#b45309]",
  "In progress": "bg-[#fef3c7] text-[#b45309]",
  Completed: "bg-[#dcfce7] text-[#16a34a]",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent font-medium", TONE[status])}
    >
      {status}
    </Badge>
  );
}
