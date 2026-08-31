import type { Metadata } from "next";

import { AddTask } from "@/components/portal/add-task";
import { PageHeader } from "@/components/portal/portal-shell";
import { TaskTable } from "@/components/portal/task-table";
import { companyScope, specialistApi } from "@/lib/specialist";

export const metadata: Metadata = { title: "Tasks" };

/**
 * All Tasks — every task on every project this specialist holds, which on a
 * single project page is the same table narrowed to one.
 *
 * Add New Task asks which project, because here there is more than one. A task
 * added to their own project is theirs: assignment is project-level, so the
 * design's missing assignee field costs nothing on this screen.
 *
 * THE BUTTON IS ALWAYS RENDERED, even with nothing to file against. Hiding it
 * left this screen with no explanation for its own emptiness — a specialist on a
 * company whose projects all belong to another speciality saw a bare table and
 * no way to act. The dialog says which of the two it is; the table's empty row
 * says the same thing without a click.
 */
export default async function SpecialistTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; page?: string }>;
}) {
  const params = await searchParams;
  const company = await companyScope(params.company);
  const [tasks, projects] = await Promise.all([
    specialistApi.allTasks(company),
    specialistApi.projects(company),
  ]);

  return (
    <>
      <PageHeader
        title="All Tasks"
        action={
          <AddTask
            from="specialist"
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
        }
      />

      <TaskTable
        tasks={tasks}
        from="specialist"
        page={Number(params.page) || 1}
        empty={
          projects.length > 0
            ? "No tasks on your projects yet."
            : "No projects assigned to you at this company."
        }
      />
    </>
  );
}
