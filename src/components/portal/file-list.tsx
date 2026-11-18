import Link from "next/link";

import { PersonCell } from "@/components/admin/initials-avatar";
import type { Column } from "@/components/admin/data-table";
import {
  DocumentActions,
  FileChip,
  FilePreview,
} from "@/components/portal/file-preview";
import { SelectBox } from "@/components/portal/delete-documents";
import { formatFileSize } from "@/lib/manager";
import { dateKey, documentPath, usDate } from "@/lib/portal";
import { cn } from "@/lib/utils";

/** What the columns below read. Every portal's file rows satisfy it. */
export interface FileRow {
  id: string;
  /** With the id, the document's download URL. See `documentPath`. */
  projectId: string | null;
  name: string;
  project: string | null;
  /**
   * The service line of the project the file hangs off — "Bookkeeping", "Tax".
   *
   * Null when the file has no project, and so no service. The document rows the
   * API sends do not carry it (`toCompanyDocument` nests only the project's
   * name, status and deadline), so pages join it on with `withService`.
   */
  service: string | null;
  owner: string;
  /** Whose row it is: the delete control is offered to them alone. */
  ownerId: string | null;
  /** Their picture, when the row carried one — see `personAvatarUrl`. */
  ownerAvatarUrl?: string | null;
  uploadedAt: string;
  size: number;
  /** Set on an archived row: when it went into the archive. */
  archivedAt?: string | null;
}

/**
 * The file organizer's columns, shared by every portal's copy of that table, so
 * one file reads the same wherever it is looked at.
 *
 * NO COMPANY COLUMN ANYWHERE NOW. 1.0 is always scoped to one company and the
 * staff pages are no exception — `companyScope` resolves to a single id on both
 * of them, and their breadcrumb names it above the table. The staff-only set
 * that added the column (`documentColumns`, over a `DocumentRow` carrying
 * `company`) is gone; the rows still carry the name, and nothing renders it.
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
        {/* Renders only inside a DocumentSelection — see SelectBox. */}
        <SelectBox doc={row} viewerId={viewer} />
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
    header: "Service",
    // As on the projects table: a company runs a handful of service lines, so
    // the checklist is short and closed.
    filter: "enum",
    cell: (row) =>
      row.service ?? <span className="text-muted-foreground">—</span>,
  },
  {
    header: "Uploaded By",
    sortValue: (row) => row.owner,
    cell: (row) => (
      <PersonCell name={row.owner} avatarUrl={row.ownerAvatarUrl} />
    ),
  },
  {
    header: "Upload Date",
    filter: "date",
    sortValue: (row) => dateKey(row.uploadedAt),
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
 * The Archive tab's columns: the file organizer's, plus the day each file was
 * archived, with Unarchive in place of Archive on the row's controls.
 */
export const archiveColumns = (viewer: string): Column<FileRow>[] => [
  ...fileColumns(viewer).slice(0, -1),
  {
    header: "Archived On",
    filter: "date",
    sortValue: (row) => dateKey(row.archivedAt),
    cell: (row) => (
      <span className="text-muted-foreground tabular-nums">
        {row.archivedAt ? usDate(row.archivedAt) : "—"}
      </span>
    ),
  },
  {
    header: "",
    sortValue: false,
    cell: (row) => <DocumentActions doc={row} viewerId={viewer} archived />,
  },
];

/** Which list a Documents page shows, off `?view=`. */
export type DocumentsView = "documents" | "archive";

export function parseDocumentsView(raw: string | undefined): DocumentsView {
  return raw === "archive" ? "archive" : "documents";
}

/**
 * Documents · Archive over a Documents page. Links, like `ProjectTabs`, so the
 * tab survives a shared link and the back button; `href` keeps the portal's own
 * scope on each one.
 */
export function DocumentTabs({
  current,
  href,
}: {
  current: DocumentsView;
  href: (view: DocumentsView) => string;
}) {
  const tabs: { view: DocumentsView; label: string }[] = [
    { view: "documents", label: "Documents" },
    { view: "archive", label: "Archive" },
  ];
  return (
    <nav aria-label="Documents or archive" className="flex gap-1 border-b border-border">
      {tabs.map(({ view, label }) => (
        <Link
          key={view}
          href={href(view)}
          aria-current={view === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
            view === current
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** A Documents page link on `view`, keeping any query `path` already has. */
export function viewHref(path: string, view: DocumentsView): string {
  if (view === "documents") return path;
  return `${path}${path.includes("?") ? "&" : "?"}view=archive`;
}
