"use client";

import * as React from "react";

import { DataTable } from "@/components/admin/data-table";
import { TaskStatusMenu } from "@/components/portal/task-status-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SpecialistTask } from "@/lib/manager";

/**
 * All Tasks, with the detail as a dialog rather than a page.
 *
 * A task is four short fields; a route for it would cost a navigation, a back
 * press and a second layout to keep in step with this one. The design agrees —
 * it draws the detail as a popup.
 *
 * SHARED BY THE MANAGER AND THE SPECIALIST, which is why it moved out of the
 * specialist's route folder. Both read the same `GET /tasks` rows — the
 * specialist's narrowed to their own work with `?specialistUserId=`, the
 * manager's not narrowed at all — and both may move a status, so the only thing
 * that differs is which boundary the menu writes through.
 *
 * The card, the empty row and the pager are `DataTable`'s, the same component
 * every other list in this portal renders through. This screen used to build its
 * own card and its own `<Table>`, which is why it sat a heading style and a
 * pager apart from Projects one tab over.
 */
export function TaskTable({
  tasks,
  from,
  page = 1,
  empty = "No tasks on your projects yet.",
}: {
  tasks: SpecialistTask[];
  from: "manager" | "specialist";
  page?: number;
  empty?: string;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Read back out of `tasks` rather than holding the task itself: a status
  // change refreshes the page, and a captured copy would show the old badge.
  const open = tasks.find((t) => t.id === openId) ?? null;

  return (
    <>
      <DataTable<SpecialistTask>
        page={page}
        total={tasks.length}
        rows={tasks}
        basePath={`/${from}/tasks`}
        empty={empty}
        // No `rowHref`: the detail is a dialog, so the row must not navigate.
        columns={[
          {
            header: "Task",
            cell: (task) => (
              // Only the name opens the detail. A whole-row handler would
              // swallow clicks on the status menu in the last cell.
              <button
                type="button"
                onClick={() => setOpenId(task.id)}
                className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
              >
                {task.name}
              </button>
            ),
          },
          {
            header: "Description",
            cell: (task) => (
              <span className="text-muted-foreground">{task.description}</span>
            ),
          },
          { header: "Project", cell: (task) => task.project },
          {
            header: "Deadline",
            cell: (task) => (
              <span className="tabular-nums">{task.deadline}</span>
            ),
          },
          {
            header: "Status",
            cell: (task) => (
              <TaskStatusMenu
                taskId={task.id}
                status={task.status}
                from={from}
              />
            ),
          },
        ]}
      />

      <Dialog
        open={open !== null}
        onOpenChange={(next) => setOpenId(next ? openId : null)}
      >
        <DialogContent className="sm:max-w-md">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle>{open.name}</DialogTitle>
              </DialogHeader>

              <dl className="grid gap-4">
                {/* Was the dialog's subheading. It is the one field that says
                    which project the task belongs to, so it moves into the
                    list rather than disappearing with the subheading. */}
                <div>
                  <dt className="text-sm text-muted-foreground">Project</dt>
                  <dd className="mt-0.5 text-sm font-medium">{open.project}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Description</dt>
                  <dd className="mt-0.5 text-sm">{open.description}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Deadline</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums">
                    {open.deadline}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd className="mt-1.5">
                    <TaskStatusMenu
                      taskId={open.id}
                      status={open.status}
                      from={from}
                    />
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
