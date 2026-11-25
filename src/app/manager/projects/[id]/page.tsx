import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AddTask } from "@/components/portal/add-task";
import {
  DeleteProject,
  DocumentSelection,
  SelectBox,
  SelectionBar,
} from "@/components/portal/delete-documents";
import { DocumentActions, FilePreview } from "@/components/portal/file-preview";
import { ProjectTaskTable } from "@/components/portal/project-task-table";
import { ProjectDeadline } from "@/components/portal/project-deadline";
import { ExportProjectCsv } from "@/components/portal/export-csv";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  FrozenProject,
  InactiveProjectNotice,
  ProjectActiveSwitch,
  ProjectCompletion,
} from "@/components/portal/record-controls";
import { formatFileSize, managerApi, scopeSwitch, scoped } from "@/lib/manager";
import { documentPath, viewerId } from "@/lib/portal";

import { ManagerUploadFile } from "../../documents/upload-file";

export const metadata: Metadata = { title: "Project" };

/**
 * Project Details — task list, project details, project files, in 1.0's
 * arrangement (am-11-project-detail.png): the first two stacked on the left,
 * files in a right rail.
 */
export default async function ManagerProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ company?: string; sort?: string; dir?: string }>;
}) {
  const [{ id }, { company, sort, dir }] = await Promise.all([
    params,
    searchParams,
  ]);
  const project = await managerApi.project(id);
  if (!project) notFound();

  /*
   * The scope and the record have to agree. A URL that NAMES a company and a
   * project belonging to a different one is describing two different accounts
   * at once, and the tasks below would then be a project the Projects list two
   * clicks away does not have.
   *
   * That disagreement is the header switcher being used, so it is answered by
   * moving rather than by 404: the reader asked for this other company, and
   * its Projects list is what they asked to see. A bare link with no
   * `?company=` is the same disagreement the other way and pulls the scope onto
   * the project instead.
   */
  const elsewhere = scopeSwitch({
    picked: company,
    owners: [project.companyId],
    stay: `/manager/projects/${encodeURIComponent(project.id)}`,
    leave: (to) => scoped("/manager/projects", to),
  });
  if (elsewhere) redirect(elsewhere);

  const [companies, viewer] = await Promise.all([
    managerApi.companies(),
    viewerId(),
  ]);
  const creator = project.creatorId === viewer;

  // Frozen (16 Nov): a project of an inactive company shows its name and
  // nothing inside it. An inactive project itself only goes read-only (25 Nov).
  const companyInactive =
    companies.find((c) => c.id === project.companyId)?.inactive ?? false;
  if (companyInactive) {
    return (
      <>
        <PageHeader title="Project Details" description={project.name} />
        <FrozenProject />
      </>
    );
  }

  const [documents, tasks] = await Promise.all([
    managerApi.documents(project.companyId),
    managerApi.tasks(project.id),
  ]);

  const attached = documents
    .filter((d) => d.project === project.name)
    .map((d) => ({ ...d, locked: project.inactive }));
  // Completed is final until reopened: no new tasks, uploads or status moves.
  // Inactive is read-only the same way, until its creator switches it back.
  const completed = project.status === "Completed";
  const locked = completed || project.inactive;

  return (
    <>
      {/* No Assign control: the specialist follows the company's staffing for
          this project's service line, set on the Companies screen. */}
      <PageHeader
        title="Project Details"
        description={project.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Creator only, like Delete Project below. */}
            {creator && (
              <ProjectActiveSwitch
                projectId={project.id}
                name={project.name}
                inactive={project.inactive}
              />
            )}
            {/* Not while inactive: the server refuses status changes then. */}
            {!project.inactive && (
              <ProjectCompletion
                projectId={project.id}
                name={project.name}
                status={project.status}
                openTasks={tasks.filter((t) => t.status !== "Completed").length}
              />
            )}
            <ExportProjectCsv projectId={project.id} projectName={project.name} />
            {/* Creator only (Sir, Q2): an accounting manager can't delete the
                customer's project, even on their own company. */}
            {creator && (
              <DeleteProject
                projectId={project.id}
                name={project.name}
                tasks={tasks.length}
                documents={attached.length}
                after={scoped("/manager/projects", project.companyId)}
              />
            )}
          </div>
        }
      />
      {project.inactive && <InactiveProjectNotice creator={creator} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-4 border-b border-border p-6">
              <h2 className="text-sm font-semibold">Tasks</h2>
              {!locked && (
                <AddTask
                  from="manager"
                  projects={[
                    {
                      id: project.id,
                      name: project.name,
                      deadline: project.deadline,
                    },
                  ]}
                />
              )}
            </div>

            <ProjectTaskTable
              tasks={tasks}
              from="manager"
              sort={sort}
              dir={dir}
              locked={locked}
            />
          </section>

          <DetailSection title="General Information">
            <DetailRow label="Created On" value={project.createdOn} />
            <DetailRow
              label="Deadline"
              value={
                <ProjectDeadline
                  deadline={project.deadline}
                  status={project.status}
                />
              }
            />
            <DetailRow label="Service" value={project.service} />
            <DetailRow
              label="Specialist"
              value={project.specialist ?? "Unassigned"}
            />
            <DetailRow label="Company Name" value={project.company} />
            <DetailRow label="Created By" value={project.createdBy} />
            {project.previousProject && (
              <DetailRow
                label="Previous Project"
                value={
                  <Link
                    href={scoped(
                      `/manager/projects/${encodeURIComponent(project.previousProject.id)}`,
                      project.companyId,
                    )}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {project.previousProject.name}
                  </Link>
                }
              />
            )}
          </DetailSection>

        </div>

        <DocumentSelection>
          <section className="rounded-xl border border-border bg-card p-6 lg:self-start">
            <h2 className="mb-4 text-sm font-semibold">Documents</h2>

            <div className="mb-4 flex gap-2">
              {/*
               * Upload was disabled behind "the backend does not have file
               * storage yet". It does — GET /api/health reports
               * `storage: "supabase"`, and Documents has been uploading
               * through the same three-step handshake all along. Pre-scoped to
               * this project, so the dialog asks nothing the page already knows.
               *
               * Download stays out: the bulk endpoint is a POST returning signed
               * links, and no boundary function calls it yet. A per-file control
               * belongs on the row rather than above the list.
               */}
              {!locked && (
                <ManagerUploadFile
                  companies={[{ id: project.companyId, name: project.company }]}
                  projects={[{ name: project.name, companyId: project.companyId }]}
                  fixed
                />
              )}
              <SelectionBar />
            </div>

            {attached.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files attached.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {attached.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 py-3">
                    <SelectBox doc={doc} viewerId={viewer} />
                    <span className="min-w-0 flex-1 text-sm">
                      <FilePreview
                        name={doc.name}
                        href={documentPath(doc)}
                        size={doc.size}
                        className="block max-w-full"
                      />
                      {/* Who put it there and when — the two facts the file
                          organizer's own columns carry, and the two a reader
                          cannot get from the name. */}
                      <span className="block text-xs text-muted-foreground">
                        {doc.owner} · <span className="tabular-nums">{doc.uploadedAt} · {formatFileSize(doc.size)}</span>
                      </span>
                    </span>
                    <DocumentActions doc={doc} viewerId={viewer} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </DocumentSelection>
      </div>
    </>
  );
}
