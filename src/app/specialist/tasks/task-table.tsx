"use client";

import * as React from "react";

import { TaskStatusMenu } from "@/components/portal/task-status-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SpecialistTask } from "@/lib/manager";

/**
 * All Tasks, with the detail as a dialog rather than a page.
 *
 * A task is four short fields; a route for it would cost a navigation, a back
 * press and a second layout to keep in step with this one. The design agrees —
 * it draws the detail as a popup.
 */
export function TaskTable({ tasks }: { tasks: SpecialistTask[] }) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Read back out of `tasks` rather than holding the task itself: a status
  // change refreshes the page, and a captured copy would show the old badge.
  const open = tasks.find((t) => t.id === openId) ?? null;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Task</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="h-32 text-center text-sm text-muted-foreground"
              >
                No tasks on your projects yet.
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  {/* Only the name opens the detail. A whole-row handler would
                      swallow clicks on the status menu in the last cell. */}
                  <button
                    type="button"
                    onClick={() => setOpenId(task.id)}
                    className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                  >
                    {task.name}
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {task.description}
                </TableCell>
                <TableCell>{task.project}</TableCell>
                <TableCell className="tabular-nums">{task.deadline}</TableCell>
                <TableCell>
                  <TaskStatusMenu
                    taskId={task.id}
                    status={task.status}
                    from="specialist"
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
                      from="specialist"
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
