import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { PersonCell } from "@/components/admin/initials-avatar";
import {
  DeleteProject,
  DocumentSelection,
  SelectBox,
  SelectionBar,
} from "@/components/portal/delete-documents";
import { DocumentActions, FilePreview } from "@/components/portal/file-preview";
import { StatusBadge } from "@/components/portal/status-badge";
import { ProjectDeadline } from "@/components/portal/project-deadline";
import { ExportProjectCsv } from "@/components/portal/export-csv";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  FrozenProject,
  ProjectActiveSwitch,
} from "@/components/portal/record-controls";
import { ProjectTaskTable } from "@/components/portal/project-task-table";

import { CustomerUploadFile } from "../../files/upload-file";
import { customerApi, type CustomerFile } from "@/lib/customer";
import {
  dateKey,
  documentPath,
  serviceHref,
  serviceTab,
  viewerId,
} from "@/lib/portal";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Project" };

/**
 * Project detail. 1.0 has this screen (customer-project-detail.png) but we
 * never reached it with a populated list, so the field set is the row's data,
 * the tasks the AM has broken it into, and the files attached to it.
 *
 * The task list is read-only here: the customer cannot add a task or move its
 * status (docs/functionality-matrix.md), they watch the AM's breakdown progress.
 */
export default async function CustomerProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<{
    page?: string;
    size?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
    service?: string;
  }>;
}) {
  const [{ workspace, id }, { page: raw, size: rawSize, sort, dir, f, service }] =
    await Promise.all([params, searchParams]);
  const page = parsePage(raw);
  const size = parsePageSize(rawSize);
  const project = await customerApi.project(workspace, id);

  if (!project) notFound();

  // The sidebar lights a service row off `?service=`, and only the Projects
  // list links here with it. The bell, chat and a pasted link do not, so they
  // are sent on to the project's own service: the row is lit however the
  // reader arrived, and Back returns to the list this project is on.
  if (!service) {
    redirect(
      serviceHref(
        `/customer/${workspace}/projects/${encodeURIComponent(id)}`,
        serviceTab(project.service),
      ),
    );
  }

  const viewer = await viewerId();
  const creator = project.creatorId === viewer;

  // Frozen (16 Nov): name only. An inactive company never gets this far — the
  // workspace layout stops it.
  if (project.inactive) {
    return (
      <>
        <PageHeader
          title="Project Details"
          description={project.name}
          action={
            creator ? (
              <div className="flex flex-wrap items-center gap-2">
                <ProjectActiveSwitch
                  projectId={project.id}
                  name={project.name}
                  inactive
                />
                <DeleteProject
                  projectId={project.id}
                  name={project.name}
                  after={`/customer/${encodeURIComponent(workspace)}/projects`}
                />
              </div>
            ) : undefined
          }
        />
        <FrozenProject companyInactive={false} creator={creator} />
      </>
    );
  }

  const [tasks, files] = await Promise.all([
    customerApi.tasks(project.id),
    customerApi.files(workspace, project.name),
  ]);

  return (
    <>
      <PageHeader
        title="Project Details"
        description={project.name}
        /* A DIV, not a fragment: PageHeader's row is `justify-between`, so two
           bare children would be pushed to opposite ends of it with the title
           stranded between them. These two are a pair on the right. */
        action={
          <div className="flex flex-wrap items-center gap-2">
            {creator && (
              <ProjectActiveSwitch
                projectId={project.id}
                name={project.name}
                inactive={project.inactive}
              />
            )}
            <StatusBadge status={project.status} />
            <ExportProjectCsv projectId={project.id} projectName={project.name} />
            {/* Creator only (Sir, Q2): a customer can't delete a project their
                accounting manager opened. */}
            {creator && (
              <DeleteProject
                projectId={project.id}
                name={project.name}
                tasks={tasks.length}
                documents={files.length}
                after={`/customer/${encodeURIComponent(workspace)}/projects`}
              />
            )}
          </div>
        }
      />

      <div className="grid gap-6">
        <DetailSection title="General Information">
          <DetailRow label="Service" value={project.service} />
          <DetailRow
            label="Deadline"
            value={
              <ProjectDeadline
                deadline={project.deadline}
                status={project.status}
              />
            }
          />
          <DetailRow label="Status" value={project.status} />
          <DetailRow
            label="Specialist"
            value={project.specialist ?? "Not yet assigned"}
          />
          {project.previousProject && (
            <DetailRow
              label="Previous Project"
              value={
                <Link
                  href={`/customer/${workspace}/projects/${encodeURIComponent(project.previousProject.id)}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {project.previousProject.name}
                </Link>
              }
            />
          )}
        </DetailSection>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-sm font-semibold">Tasks</h2>
          </div>
          <ProjectTaskTable tasks={tasks} from="customer" sort={sort} dir={dir} />
        </section>

        <DocumentSelection>
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Documents</h2>
              <SelectionBar />
              {/* Pre-scoped to this project, so the dialog asks nothing the page
                  already knows — the same in-project upload the manager and
                  specialist project pages have. Open to an invited team member
                  too: documents are company-scoped, and only Billing is
                  owner-only in this portal. */}
              {/* Completed is final until the accounting manager reopens it. */}
              {project.status !== "Completed" && (
                <CustomerUploadFile
                  workspace={workspace}
                  projects={[{ name: project.name }]}
                  fixed
                />
              )}
            </div>
            <DataTable<CustomerFile>
              noun="documents"
              page={page}
              size={size}
              sort={sort}
              dir={dir}
              filters={parseFilters(f)}
              total={files.length}
              rows={files}
              empty="No files attached to this project yet."
              columns={[
                {
                  header: "Document Name",
                  // The cell is a client component, so the text it renders cannot
                  // be walked for a sort key — the name is passed instead.
                  sortValue: (row) => row.name,
                  cell: (row) => (
                    <span className="flex items-center gap-3">
                      <SelectBox doc={row} viewerId={viewer} />
                      <FilePreview
                        name={row.name}
                        href={documentPath(row)}
                        size={row.size}
                        className="block max-w-full font-medium"
                      />
                    </span>
                  ),
                },
                {
                  header: "Uploaded By",
                  sortValue: (row) => row.owner,
                  cell: (row) => <PersonCell name={row.owner} avatarUrl={row.ownerAvatarUrl} />,
                },
                {
                  header: "Upload Date",
                  sortValue: (row) => dateKey(row.uploadedAt),
                  cell: (row) => (
                    <span className="text-muted-foreground">
                      {row.uploadedAt}
                    </span>
                  ),
                },
                {
                  // Unheaded and unsortable, as on the file organizer: a header
                  // over two icons only takes width off the columns that say
                  // something.
                  header: "",
                  sortValue: false,
                  cell: (row) => <DocumentActions doc={row} viewerId={viewer} />,
                },
              ]}
            />
          </section>
        </DocumentSelection>

      </div>
    </>
  );
}
