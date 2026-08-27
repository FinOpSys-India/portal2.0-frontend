import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { AddTask } from "@/components/portal/add-task";
import { TaskStatusMenu } from "@/components/portal/task-status-menu";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { managerApi } from "@/lib/manager";

export const metadata: Metadata = { title: "Specialist" };

/**
 * Specialists Detail — every task the specialist is carrying on the left,
 * who they are on the right.
 *
 * Assignment is project-level, so "their tasks" means the tasks of the
 * projects routed to them. Add New Task therefore asks which of those
 * projects the task belongs to.
 */
export default async function ManagerSpecialistPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const specialist = await managerApi.specialist(decodeURIComponent(email));

  if (!specialist) notFound();

  const [tasks, projects] = await Promise.all([
    managerApi.specialistTasks(specialist.email),
    managerApi.projects(),
  ]);

  const theirs = projects.filter((p) => p.specialist === specialist.name);

  return (
    <>
      <PageHeader title="Specialists Detail" description={specialist.name} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-4 border-b border-border p-6">
            <h2 className="text-sm font-semibold">All Tasks</h2>
            {/* Nothing to attach a task to until the specialist has a project. */}
            {theirs.length > 0 ? (
              <AddTask
                from="manager"
                projects={theirs.map((p) => ({ id: p.id, name: p.name }))}
              />
            ) : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {/* The design labels this column "File name" on a table of
                    tasks. Named for what it holds. */}
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No tasks assigned yet.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <span className="font-medium">{task.name}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {task.description}
                      </span>
                    </TableCell>
                    <TableCell>{task.project}</TableCell>
                    <TableCell className="tabular-nums">
                      {task.deadline}
                    </TableCell>
                    <TableCell>
                      <TaskStatusMenu
                        taskId={task.id}
                        status={task.status}
                        from="manager"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <div className="grid gap-6 lg:self-start">
          <section className="flex items-center gap-3 rounded-xl border border-border bg-card p-6">
            <InitialsAvatar name={specialist.name} className="size-10" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{specialist.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {specialist.speciality}
              </p>
            </div>
          </section>

          <DetailSection title="Personal Details">
            <DetailRow label="Full Name" value={specialist.name} />
            <DetailRow label="Email Address" value={specialist.email} />
            <DetailRow label="Phone number" value={specialist.phone} />
            <DetailRow label="Address" value={specialist.address} />
          </DetailSection>
        </div>
      </div>
    </>
  );
}
