"use client";

import * as React from "react";

import { TaskStatusBadge } from "@/components/portal/task-status-badge";
import { TaskStatusMenu } from "@/components/portal/task-status-menu";
import {
  SortableHeadRow,
  sortRows,
  type SortableColumn,
} from "@/components/admin/data-table";
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
  TableRow,
} from "@/components/ui/table";
import { parseDeadline, type ProjectTask } from "@/lib/manager";

/*
 * THE SAME COLUMNS, IN THE SAME ORDER, AS THE OTHER TWO TASK TABLES — the
 * specialist's Tasks page and the manager's Specialist Details. All three list
 * tasks, and all three used to disagree: this one headed its first column
 * "Name" where they head it "Task", and put Status third where they put it
 * last.
 *
 * No Project Name, which the other two carry. This table is already on one
 * project's page, so the cell would repeat that project's name down every row —
 * the same reason the file organisers dropped their Company column.
 */
/*
 * WIDTHS ON THREE OF THE FOUR. `w-*` lands on the header cell, which is what
 * the column distribution is computed against — a cell `max-width` is not, and
 * left to itself the auto layout gave Description all the slack in this
 * `w-full` table and rendered it 1062px wide.
 *
 * Description is the free-text column and takes the space; Task and Deadline
 * give up 50px each to pay for it. Status stays unpinned deliberately, so one
 * column can still absorb whatever a wider screen leaves over rather than the
 * table under-filling its card.
 *
 * ponytail: PIXELS, MEASURED AT ONE WIDTH. These are hints, not a fixed layout
 * — the browser still shrinks them when the space is not there — but they were
 * read off a 2560px viewport, so a much narrower screen divides what is left
 * differently. Percentages are the fix if these ever need to hold across
 * breakpoints.
 */
const COLUMNS: SortableColumn<ProjectTask>[] = [
  { header: "Task", className: "w-[435px]", sortValue: (task) => task.name },
  {
    header: "Description",
    className: "w-[484px]",
    sortValue: (task) => task.description,
  },
  // M/DD/YY: "8/03/26" sorts before "7/28/26" as text.
  {
    header: "Deadline",
    className: "w-[521px]",
    sortValue: (task) => parseDeadline(task.deadline).getTime(),
  },
  { header: "Status", sortValue: (task) => task.status },
];

/**
 * The task list on a project detail page, in 1.0's four columns.
 *
 * `from` decides both which portal's endpoint a write posts to and whether
 * anything here is writable at all. The specialist does the work and the
 * accounting manager plans it, so both move a status — the same two people
 * `PATCH /tasks/:id/status` admits. The customer follows the job and reads it.
 *
 * The design labels this table's first column `File name` on a table that holds
 * task names (docs/specialist-portal.md). Named for what it holds — Task, the
 * word the portal's other two task tables already use.
 *
 * THE NAME OPENS THE ROW, as it does on the specialist's Tasks page, and for a
 * reason this table now depends on: every cell is capped and clipped with an
 * ellipsis (see `TableCell`), so a description longer than the column is a
 * sentence the reader can see the start of and nowhere to read the rest. The
 * dialog is where the rest lives.
 */
export function ProjectTaskTable({
  tasks,
  from,
  sort,
  dir,
}: {
  tasks: ProjectTask[];
  from: "manager" | "specialist" | "customer";
  sort?: string;
  dir?: string;
}) {
  const writable = from !== "customer";
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Read back out of `tasks` rather than holding the task: a status change
  // refreshes the page, and a captured copy would show the old badge.
  const open = tasks.find((t) => t.id === openId) ?? null;

  return (
    <>
      <Table>
        <SortableHeadRow columns={COLUMNS} sort={sort} dir={dir} />
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={COLUMNS.length}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No tasks on this project yet.
              </TableCell>
            </TableRow>
          ) : (
            sortRows(tasks, COLUMNS, sort, dir).map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">
                  {/* Only the name opens the detail. A whole-row handler would
                      swallow clicks on the status menu two cells over. */}
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
                <TableCell className="tabular-nums">{task.deadline}</TableCell>
                <TableCell>
                  {writable ? (
                    <TaskStatusMenu
                      taskId={task.id}
                      status={task.status}
                      from={from}
                    />
                  ) : (
                    <TaskStatusBadge status={task.status} />
                  )}
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
                {/*
                 * `wrap-anywhere`, here and on the description below, because
                 * this dialog exists to show text the table could not fit —
                 * including the space-less string that broke the page in the
                 * first place. `overflow-wrap: anywhere` and not `break-word`:
                 * only the first shrinks min-content, which is what decides
                 * whether the box can be laid out at all.
                 */}
                <DialogTitle className="wrap-anywhere">{open.name}</DialogTitle>
              </DialogHeader>

              {/* Name, description, status — no deadline. It is already in the
                  row beside the name, in full, and never truncated. */}
              <dl className="grid gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Description</dt>
                  <dd className="mt-0.5 text-sm wrap-anywhere">
                    {open.description || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd className="mt-1.5">
                    {writable ? (
                      <TaskStatusMenu
                        taskId={open.id}
                        status={open.status}
                        from={from}
                      />
                    ) : (
                      <TaskStatusBadge status={open.status} />
                    )}
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
