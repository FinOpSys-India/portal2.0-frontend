import type { Metadata } from "next";

import { AddTask } from "@/components/portal/add-task";
import { specialistApi } from "@/lib/specialist";

import { TaskTable } from "./task-table";

export const metadata: Metadata = { title: "Tasks" };

/**
 * All Tasks — every task on every project this specialist holds, which on a
 * single project page is the same table narrowed to one.
 *
 * Add New Task asks which project, because here there is more than one. A task
 * added to their own project is theirs: assignment is project-level, so the
 * design's missing assignee field costs nothing on this screen.
 */
export default async function SpecialistTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const [tasks, projects] = await Promise.all([
    specialistApi.allTasks(company),
    specialistApi.projects(company),
  ]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6">
        <h1 className="text-lg font-bold tracking-tight">All Tasks</h1>
        {/* Nothing to attach a task to until they hold a project. */}
        {projects.length > 0 ? (
          <AddTask
            from="specialist"
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
        ) : null}
      </div>

      <TaskTable tasks={tasks} />
    </div>
  );
}
