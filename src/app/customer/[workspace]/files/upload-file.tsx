"use client";

import { UploadFile, type UploadMeta } from "@/components/portal/upload-file";
import { customerApi } from "@/lib/customer";

export function CustomerUploadFile({
  workspace,
  projects,
  fixed,
}: {
  workspace: string;
  projects: { name: string }[];
  /** Opened from a project page, where the project is already answered. */
  fixed?: boolean;
}) {
  return (
    <UploadFile
      // No company picker: a customer's file list is already one workspace.
      // The project is required here — every file in this list hangs off one.
      projects={projects}
      projectRequired
      fixed={fixed}
      upload={(file: File, meta: UploadMeta) =>
        customerApi.uploadFile(workspace, file, { project: meta.project ?? "" })
      }
    />
  );
}
