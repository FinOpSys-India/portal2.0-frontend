import { TaskStatusBadge } from "@/components/portal/task-status-badge";
import { TaskStatusMenu } from "@/components/portal/task-status-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectTask } from "@/lib/manager";

/**
 * The task list on a project detail page, in 1.0's four columns.
 *
 * `from` decides both which portal's endpoint a status change posts to and
 * whether the status is editable at all: the specialist is the one doing the
 * work, so they get the menu; the manager routes the job and reads the badge.
 *
 * The design labels this table's first column `File name` on a table that holds
 * task names (docs/specialist-portal.md). Named for what it holds.
 */
export function ProjectTaskTable({
  tasks,
  from,
}: {
  tasks: ProjectTask[];
  from: "manager" | "specialist";
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Deadline</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={4}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              No tasks on this project yet.
            </TableCell>
          </TableRow>
        ) : (
          tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {task.description}
              </TableCell>
              <TableCell>
                {from === "specialist" ? (
                  <TaskStatusMenu
                    taskId={task.id}
                    status={task.status}
                    from="specialist"
                  />
                ) : (
                  <TaskStatusBadge status={task.status} />
                )}
              </TableCell>
              <TableCell className="tabular-nums">{task.deadline}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
