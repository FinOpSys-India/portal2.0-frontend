import { TaskStatusBadge } from "@/components/portal/task-status-badge";
import { TaskStatusMenu } from "@/components/portal/task-status-menu";
import {
  SortableHeadRow,
  sortRows,
  type SortableColumn,
} from "@/components/admin/data-table";
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
const COLUMNS: SortableColumn<ProjectTask>[] = [
  { header: "Task", sortValue: (task) => task.name },
  { header: "Description", sortValue: (task) => task.description },
  // M/DD/YY: "8/03/26" sorts before "7/28/26" as text.
  { header: "Deadline", sortValue: (task) => parseDeadline(task.deadline).getTime() },
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

  return (
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
              <TableCell className="font-medium">{task.name}</TableCell>
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
  );
}
