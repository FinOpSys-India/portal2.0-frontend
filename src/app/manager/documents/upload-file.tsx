"use client";

import { UploadFile, type UploadMeta } from "@/components/portal/upload-file";
import { managerApi } from "@/lib/manager";

export function ManagerUploadFile({
  companies,
  projects,
  fixed,
}: {
  companies: { id: string; name: string }[];
  projects: { name: string; companyId: string }[];
  /** Opened from a project page, where both fields are already answered. */
  fixed?: boolean;
}) {
  return (
    <UploadFile
      companies={companies}
      projects={projects}
      fixed={fixed}
      upload={(file: File, meta: UploadMeta) =>
        managerApi.uploadDocument(file, meta)
      }
    />
  );
}
