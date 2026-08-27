"use client";

import { UploadFile, type UploadMeta } from "@/components/portal/upload-file";
import { customerApi } from "@/lib/customer";

export function CustomerUploadFile({
  workspace,
  projects,
}: {
  workspace: string;
  projects: { name: string }[];
}) {
  return (
    <UploadFile
      // No company picker: a customer's file list is already one workspace.
      // The project is required here — every file in this list hangs off one.
      projects={projects}
      projectRequired
      upload={(file: File, meta: UploadMeta) =>
        customerApi.uploadFile(workspace, file, { project: meta.project ?? "" })
      }
    />
  );
}
