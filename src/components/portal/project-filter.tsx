"use client";

import { ParamPill } from "@/components/portal/param-pill";
import type { PillOption } from "@/components/portal/workspace-pill";

/** Cleared filter. Empty id means "no ?project= on the URL". */
const ALL: PillOption = { id: "", name: "All projects" };

/**
 * Narrows the file list to one project.
 *
 * Filters by project *name*: that is what a document carries, since a file can
 * be uploaded before the project it belongs to exists as a record.
 */
export function ProjectFilter({ projects }: { projects: string[] }) {
  return (
    <ParamPill
      param="project"
      all={ALL}
      options={projects.map((name) => ({ id: name, name }))}
      label="Project"
      menuLabel="Filter by project"
      variant="outline"
    />
  );
}
