/**
 * CSV exports, which are downloads rather than reads.
 *
 * Two endpoints, one shape: `GET .../export` answers with a file, so nothing
 * here returns data — each function hands the bytes to the browser and resolves
 * when the save has been started. See `downloadFile` in lib/http.ts for why
 * these cannot go through the normal `get()` path.
 *
 * SHARED BY THREE PORTALS. The manager, the specialist and the customer all
 * export the same two things against the same routes; what differs is only
 * which company they are scoped to, and that arrives as an argument.
 */

import { downloadFile } from "@/lib/http";

/**
 * A filename safe to hand a filesystem, out of something a user typed.
 *
 * Only ever a FALLBACK — the server's `Content-Disposition` wins when it sends
 * one. This exists for the case where it does not, because "Q3 / Payroll.csv"
 * is not a filename on any platform: the slash makes it a path on Unix and is
 * refused outright on Windows.
 */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name
    // Path separators and the characters Windows reserves, plus control codes.
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Trailing dots and spaces are stripped by Windows on save, which silently
    // turns "report ." into "report" — do it here so the name is what it says.
    .replace(/[. ]+$/, "");

  return cleaned || fallback;
}

/**
 * Every project on one company, as a CSV.
 *
 * `companyId` is required by the endpoint and by the rule the whole app turns
 * on: a project list is always one account's, never a book-wide read.
 */
export function exportCompanyProjects(
  companyId: string,
  companyName?: string,
): Promise<void> {
  return downloadFile(
    `/projects/export?companyId=${encodeURIComponent(companyId)}`,
    safeFilename(
      companyName ? `${companyName} projects` : "projects",
      "projects",
    ) + ".csv",
  );
}

/** One project and its tasks, as a CSV. */
export function exportProject(
  projectId: string,
  projectName?: string,
): Promise<void> {
  return downloadFile(
    `/projects/${encodeURIComponent(projectId)}/export`,
    safeFilename(projectName ?? `project-${projectId}`, `project-${projectId}`) +
      ".csv",
  );
}
