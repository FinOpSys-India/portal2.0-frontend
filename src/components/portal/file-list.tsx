import { PersonCell } from "@/components/admin/initials-avatar";
import type { Column } from "@/components/admin/data-table";
import { DocumentActions, FilePreview } from "@/components/portal/file-preview";
import { fileKind, formatFileSize, type ManagerDocument } from "@/lib/manager";
import { documentPath } from "@/lib/portal";
import { cn } from "@/lib/utils";

/** What the columns below read. Every portal's file rows satisfy it. */
export interface FileRow {
  id: string;
  /** With the id, the document's download URL. See `documentPath`. */
  projectId: string | null;
  name: string;
  project: string | null;
  owner: string;
  /** Whose row it is: the delete control is offered to them alone. */
  ownerId: string | null;
  /** Their picture, when the row carried one — see `personAvatarUrl`. */
  ownerAvatarUrl?: string | null;
  uploadedAt: string;
  size: number;
}

/**
 * The file organiser's columns, shared by every portal's copy of that table —
 * the customer's included, so one file reads the same wherever it is looked at.
 *
 * Company is not among them: 1.0 is always scoped to one company, so it never
 * needs to say which.
 *
 * A FUNCTION, not a constant, because the last column depends on who is
 * looking: the delete control is offered on your own uploads only, and the
 * rows carry no viewer. Pages pass `await viewerId()`.
 */
export const fileColumns = (viewer: string): Column<FileRow>[] => [
  {
    header: "Document Name",
    // The name alone: the chip beside it renders the extension, which would
    // otherwise group the column by file type before name.
    sortValue: (row) => row.name,
    cell: (row) => (
      <span className="flex items-center gap-3">
        <FileChip name={row.name} />
        <span className="min-w-0">
          <FilePreview
            name={row.name}
            href={documentPath(row)}
            size={row.size}
            className="block max-w-full font-medium"
          />
          <span className="block text-sm text-muted-foreground tabular-nums">
            {formatFileSize(row.size)}
          </span>
        </span>
      </span>
    ),
  },
  {
    header: "Project Name",
    // A finite list on any real company, so it filters as a checklist.
    filter: "enum",
    // Files arrive before there is a project to attach them to.
    cell: (row) =>
      row.project ?? <span className="text-muted-foreground">Unattached</span>,
  },
  {
    header: "Document Owner",
    sortValue: (row) => row.owner,
    cell: (row) => (
      <PersonCell name={row.owner} avatarUrl={row.ownerAvatarUrl} />
    ),
  },
  {
    header: "Upload Date",
    filter: "date",
    sortValue: (row) => Date.parse(row.uploadedAt) || 0,
    cell: (row) => (
      <span className="text-muted-foreground tabular-nums">
        {row.uploadedAt}
      </span>
    ),
  },
  {
    // Unheaded and unsortable: there is nothing to order rows by here, and a
    // header over three icons only takes width off the columns that say
    // something.
    header: "",
    sortValue: false,
    cell: (row) => <DocumentActions doc={row} viewerId={viewer} />,
  },
];

/**
 * The staff lists span companies by default, so theirs name the company. A
 * customer's list cannot — it is one workspace — and uses `fileColumns`.
 */
export const documentColumns = (viewer: string): Column<ManagerDocument>[] => {
  const [name, ...rest] = fileColumns(viewer);
  return [
    name,
    { header: "Company", filter: "enum", cell: (row) => row.company },
    ...rest,
  ];
};

/**
 * Extension chip. Colour is by family, not by extension: a reader scanning the
 * column wants "document / image / video", and seven unrelated hues would be
 * noise dressed as information.
 */
const FAMILY: Record<string, string> = {
  pdf: "bg-[#fee2e2] text-[#b91c1c]",
  doc: "bg-[#dbeafe] text-[#1d4ed8]",
  docx: "bg-[#dbeafe] text-[#1d4ed8]",
  xls: "bg-[#dcfce7] text-[#15803d]",
  xlsx: "bg-[#dcfce7] text-[#15803d]",
  csv: "bg-[#dcfce7] text-[#15803d]",
  png: "bg-[#ede9fe] text-[#6d28d9]",
  jpg: "bg-[#ede9fe] text-[#6d28d9]",
  jpeg: "bg-[#ede9fe] text-[#6d28d9]",
};

export function FileChip({ name }: { name: string }) {
  const kind = fileKind(name);

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
        FAMILY[kind.toLowerCase()] ?? "bg-muted text-muted-foreground",
      )}
    >
      {kind.slice(0, 4)}
    </span>
  );
}

/**
 * What the file list is currently showing.
 *
 * Two filters sit in two different places — the company switcher in the header,
 * the project pill on the page — so without this the reader has to assemble the
 * scope from opposite corners of the screen.
 *
 * No third crumb: there is no file detail view, so nothing is ever open below
 * the project.
 */
export function ScopeBreadcrumb({
  company,
  project,
}: {
  company: string | null;
  project: string | null;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-card px-5 py-3 text-sm"
    >
      <ol className="flex min-w-0 items-center gap-2">
        <li className="truncate text-muted-foreground">
          {company ?? "No company"}
        </li>
        <li aria-hidden className="text-muted-foreground">
          /
        </li>
        <li aria-current="page" className="truncate font-medium">
          {project ?? "All projects"}
        </li>
      </ol>
    </nav>
  );
}
