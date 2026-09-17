import { EditTask, EditedBadge } from "@/components/portal/edit-task";
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

const COLUMNS: SortableColumn<ProjectTask>[] = [
  { header: "Name", sortValue: (task) => task.name },
  { header: "Description", sortValue: (task) => task.description },
  { header: "Status", sortValue: (task) => task.status },
  // M/DD/YY: "8/03/26" sorts before "7/28/26" as text.
  { header: "Deadline", sortValue: (task) => parseDeadline(task.deadline).getTime() },
  // The edit button. Nothing to order by, and the header is blank so the icon
  // column reads as a gutter rather than a field.
  { header: "", sortValue: false, className: "w-12" },
];

/** The customer reads this table; the two who work the account write to it. */
const COLUMNS_READONLY = COLUMNS.slice(0, -1);

/**
 * The task list on a project detail page, in 1.0's four columns.
 *
 * `from` decides both which portal's endpoint a write posts to and whether
 * anything here is writable at all. The specialist does the work and the
 * accounting manager plans it, so both move a status and both fix what a task
 * says — the same two people `POST /tasks` and `PATCH /tasks/:id` admit. The
 * customer follows the job and reads a badge.
 *
 * The design labels this table's first column `File name` on a table that holds
 * task names (docs/specialist-portal.md). Named for what it holds.
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
  const columns = writable ? COLUMNS : COLUMNS_READONLY;

  return (
    <Table>
      <SortableHeadRow columns={columns} sort={sort} dir={dir} />
      <TableBody>
        {tasks.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={columns.length}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              No tasks on this project yet.
            </TableCell>
          </TableRow>
        ) : (
          sortRows(tasks, columns, sort, dir).map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">
                {task.name}
                <EditedBadge edited={task.edited} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {task.description}
              </TableCell>
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
              <TableCell className="tabular-nums">{task.deadline}</TableCell>
              {writable ? (
                <TableCell>
                  <EditTask task={task} from={from} />
                </TableCell>
              ) : null}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
