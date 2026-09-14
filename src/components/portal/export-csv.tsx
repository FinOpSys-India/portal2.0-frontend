"use client";

import * as React from "react";
import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  companyProjectsExportPath,
  projectExportFilename,
  projectExportPath,
  projectsExportFilename,
} from "@/lib/export";
import { downloadFile, saveCsv } from "@/lib/http";

/** The narrowed rows, serialized by the table that knows what `?f=` removed. */
export type FilteredCsv = { csv: string; filename: string; count: number };

/**
 * The CSV export control.
 *
 * ONE BUTTON OR TWO CHOICES, decided by whether the list is narrowed. With no
 * filters applied there is only one thing "export" can mean, and a menu holding
 * a single item is a click in the way. Once a filter is on, the two meanings
 * genuinely differ and the reader has to pick.
 *
 * THE TWO COME FROM DIFFERENT PLACES, and that is not an implementation detail
 * the labels can hide:
 *
 *   `all`      re-queries the backend, which holds rows this page never loaded
 *              and is the authority on what the account contains.
 *   `filtered` is built from the rows ON SCREEN, because that is the only thing
 *              that can honour the filters. `?f=` is applied by the table over
 *              the rows it was handed — the export endpoint has never heard of
 *              it, so "give me the filtered ones" is not a request that can be
 *              made of the server.
 *
 * So a filtered export carries the columns as shown, and an unfiltered one
 * carries whatever the backend puts in its file. The menu names each by what it
 * contains rather than calling both "Export", because they are not the same
 * file with fewer rows.
 */
function ExportMenu({
  all,
  filtered,
}: {
  all?: { path: string; filename: string };
  filtered?: FilteredCsv;
}) {
  const [pending, setPending] = React.useState(false);

  async function run(action: () => void | Promise<void>) {
    if (pending) return;
    setPending(true);
    try {
      await action();
      // Said explicitly because the browser's own signal is easy to miss: the
      // download lands in a shelf or a corner of the toolbar, and on a file
      // that saves instantly there is otherwise no sign the click did anything.
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export that.");
    } finally {
      setPending(false);
    }
  }

  const icon = pending ? <Spinner className="size-4" /> : <Download aria-hidden />;

  // Nothing to offer — a list with no backend export and nothing on screen.
  // A button that cannot produce a file is worse than no button.
  if (!all && !filtered) return null;

  if (!all || !filtered) {
    const single = filtered;
    return (
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          run(() =>
            single ? saveCsv(single.csv, single.filename) : downloadFile(all!.path, all!.filename),
          )
        }
      >
        {icon}
        Export CSV
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={pending}>
          {icon}
          Export CSV
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Filtered FIRST, and named with its count. It is what the reader is
            looking at, so it is the one they almost always mean, and the count
            is what makes the two tellable apart at a glance. */}
        <DropdownMenuItem
          onSelect={() => run(() => saveCsv(filtered.csv, filtered.filename))}
        >
          {`These ${filtered.count} ${filtered.count === 1 ? "row" : "rows"}`}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => run(() => downloadFile(all.path, all.filename))}
        >
          Everything, ignoring filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Every project on one company.
 *
 * This wrapper exists because of the boundary: every projects page is a SERVER
 * component, and a function is not serializable across it — so the id crosses
 * and the call is built on this side.
 *
 * With no company there is no backend export to offer: the manager's list opens
 * unscoped until one is picked, and the endpoint requires `companyId`. The
 * filtered export still works, because it needs nothing but the rows.
 */
export function ExportProjectsCsv({
  companyId,
  companyName,
  filtered,
}: {
  companyId?: string;
  companyName?: string;
  filtered?: FilteredCsv;
}) {
  return (
    <ExportMenu
      all={
        companyId
          ? {
              path: companyProjectsExportPath(companyId),
              filename: projectsExportFilename(companyName),
            }
          : undefined
      }
      filtered={filtered}
    />
  );
}

/** One project and its tasks. No filters — a detail page is a single record. */
export function ExportProjectCsv({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  return (
    <ExportMenu
      all={{
        path: projectExportPath(projectId),
        filename: projectExportFilename(projectId, projectName),
      }}
    />
  );
}
