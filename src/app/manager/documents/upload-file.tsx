"use client";

import { UploadFile, type UploadMeta } from "@/components/portal/upload-file";
import { managerApi } from "@/lib/manager";

export function ManagerUploadFile({
  companies,
  projects,
  owner,
}: {
  companies: { id: string; name: string }[];
  projects: { name: string; companyId: string }[];
  /** The manager's own name. The mock stores it; a server takes it from the
      session instead, which is why it never leaves this wrapper. */
  owner: string;
}) {
  return (
    <UploadFile
      companies={companies}
      projects={projects}
      upload={(file: File, meta: UploadMeta) =>
        managerApi.uploadDocument(file, { ...meta, owner })
      }
    />
  );
}
