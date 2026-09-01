"use client";

import { UploadFile, type UploadMeta } from "@/components/portal/upload-file";
import { managerApi } from "@/lib/manager";

export function ManagerUploadFile({
  companies,
  projects,
}: {
  companies: { id: string; name: string }[];
  projects: { name: string; companyId: string }[];
}) {
  return (
    <UploadFile
      companies={companies}
      projects={projects}
      upload={(file: File, meta: UploadMeta) =>
        managerApi.uploadDocument(file, meta)
      }
    />
  );
}
