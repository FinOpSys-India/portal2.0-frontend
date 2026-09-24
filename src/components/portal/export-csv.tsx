"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { type Column, toCsv } from "@/components/admin/data-table";
import { saveCsv } from "@/lib/http";
import type { ProjectTask } from "@/lib/manager";

/** The narrowed rows, serialized by the table that knows what `?f=` removed. */
export type FilteredCsv = { csv: string; filename: string; count: number };

/**
 * The CSV export control.
 *
 * BUILT IN THE BROWSER, from the rows on screen. There is no server-side export
 * endpoint — `GET /projects/export` and `GET /projects/:id/export` were called
 * here and exist on no backend — so the only file this can produce is the one
 * made from what the table was handed. `?f=` is applied by the table over those
 * rows, so the download honours the filters by construction.
 *
 * Renders nothing when there is nothing on screen: a button that cannot produce
 * a file is worse than no button.
 */
export function ExportProjectsCsv({ filtered }: { filtered?: FilteredCsv }) {
  const [pending, setPending] = React.useState(false);

  if (!filtered) return null;

  async function run() {
    if (pending || !filtered) return;
    setPending(true);
    try {
      saveCsv(filtered.csv, filtered.filename);
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

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={run}>
      {pending ? <Spinner className="size-4" /> : <Download aria-hidden />}
      Export CSV
    </Button>
  );
}

/**
 * The four columns the task table shows, for the file it exports.
 *
 * SAME COLUMNS, SAME ORDER as `ProjectTaskTable` — the export is meant to be
 * the screen in a spreadsheet, and a file whose columns do not match the table
 * above it reads as a different report.
 *
 * `toCsv` rather than joining strings here: it is what runs every cell through
 * `csvField`, which defuses the leading `=`/`+`/`-`/`@` that Excel would
 * otherwise execute as a formula. Task names come from customers and this file
 * is opened by staff, so that is the path that matters.
 */
const TASK_COLUMNS: Column<ProjectTask>[] = [
  { header: "Name", cell: (task) => task.name },
  { header: "Description", cell: (task) => task.description },
  { header: "Status", cell: (task) => task.status },
  { header: "Deadline", cell: (task) => task.deadline },
];

/**
 * One project's tasks, as a CSV.
 *
 * BUILT FROM THE ROWS THE PAGE ALREADY HAS. There is no `GET /projects/:id/
 * export` on any backend — this used to call one and download whatever came
 * back. The page has already fetched the tasks to draw the table, so the file
 * costs no request at all, and it says exactly what the reader is looking at.
 *
 * No button on a project with no tasks: the file would be a header row.
 */
export function ExportProjectCsv({
  projectName,
  tasks,
}: {
  projectName: string;
  tasks: ProjectTask[];
}) {
  if (!tasks.length) return null;

  const base = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <ExportProjectsCsv
      filtered={{
        csv: toCsv(TASK_COLUMNS, tasks),
        filename: `${base || "project"}-tasks.csv`,
        count: tasks.length,
      }}
    />
  );
}
