"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { exportCompanyProjects, exportProject } from "@/lib/export";

/**
 * The CSV export button, on a list or on one record.
 *
 * The two wrappers at the bottom are what pages actually render, and they exist
 * because of the boundary: every projects page is a SERVER component, and a
 * function is not serializable across it — passing `run` from there would fail
 * at the point React tries to send it. So the ids cross instead, and the call
 * is built on this side.
 *
 * PENDING STATE IS NOT DECORATION. An export is a server-side query answered as
 * a file, so nothing on the page changes when it succeeds — the only feedback a
 * browser gives is the download itself, which on a slow report arrives seconds
 * after the click. Without the spinner and the disable, the button reads as
 * dead and gets pressed repeatedly, each press starting another query.
 *
 * Failures go to a toast rather than an inline alert: this button sits in a
 * table header and beside a page title, where there is no form to put a message
 * under, and the messages that matter here (a 402 from the paywall, an endpoint
 * that is not deployed) are sentences rather than field errors.
 */
function ExportCsv({
  run,
  label = "Export CSV",
  disabled = false,
}: {
  run: () => Promise<void>;
  /** Overridden where the surrounding buttons are already verbose. */
  label?: string;
  /** For a scope that cannot be exported — no company picked, an empty list. */
  disabled?: boolean;
}) {
  const [pending, setPending] = React.useState(false);

  async function download() {
    if (pending) return;
    setPending(true);
    try {
      await run();
      // Said explicitly because the browser's own signal is easy to miss: the
      // download lands in a shelf or a corner of the toolbar, and on a file
      // that saves instantly there is otherwise no sign the click did anything.
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not export that.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={download}
      disabled={pending || disabled}
    >
      {pending ? <Spinner className="size-4" /> : <Download aria-hidden />}
      {label}
    </Button>
  );
}

/**
 * Every project on one company.
 *
 * Disabled with no company, which is a real state rather than a defensive one:
 * the manager's list opens unscoped until a company is picked, and the endpoint
 * requires `companyId` — the request would be a 400 the moment it left.
 */
export function ExportProjectsCsv({
  companyId,
  companyName,
}: {
  companyId?: string;
  companyName?: string;
}) {
  return (
    <ExportCsv
      disabled={!companyId}
      run={() => exportCompanyProjects(companyId!, companyName)}
    />
  );
}

/** One project and its tasks. */
export function ExportProjectCsv({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  return (
    <ExportCsv run={() => exportProject(projectId, projectName)} />
  );
}
