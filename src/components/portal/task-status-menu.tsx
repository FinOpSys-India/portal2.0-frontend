"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { TaskStatusBadge } from "@/components/portal/task-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { managerApi, type TaskStatus } from "@/lib/manager";
import { specialistApi } from "@/lib/specialist";

/** All three states 1.0 stores. The design's menu offers only two. */
const STATUSES: TaskStatus[] = ["To do", "In progress", "Completed"];

/**
 * Which portal is moving the task. Named rather than passed as a function: the
 * callers are Server Components, and a function cannot cross that boundary.
 */
const SET = {
  manager: managerApi.setTaskStatus,
  specialist: specialistApi.setTaskStatus,
};

/**
 * The status badge, clickable — moving a task on is the one thing this screen
 * exists to do, and 1.0 makes it a two-item menu that cannot express the
 * "In progress" state its own table displays.
 */
export function TaskStatusMenu({
  taskId,
  status,
  from,
}: {
  taskId: string;
  status: TaskStatus;
  from: keyof typeof SET;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function change(next: TaskStatus) {
    if (next === status || pending) return;
    setPending(true);
    try {
      await SET[from](taskId, next);
      router.refresh();
    } catch (err) {
      // A badge is not a form — there is nowhere in this menu to put a
      // message, so a failed move used to leave the old status on screen and
      // say nothing, which reads as a click that did not register.
      toast.error(
        err instanceof Error ? err.message : "Could not move that task.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="rounded-4xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-60"
        aria-label={`Status: ${status}. Change it.`}
      >
        <TaskStatusBadge status={status} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {STATUSES.map((option) => (
          <DropdownMenuItem key={option} onSelect={() => change(option)}>
            {option}
            {option === status ? (
              <Check className="ml-auto size-3.5" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
