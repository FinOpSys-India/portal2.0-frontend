"use client";

import { UploadFile, type UploadMeta } from "@/components/portal/upload-file";
import { specialistApi } from "@/lib/specialist";

export function SpecialistUploadFile({
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
        specialistApi.uploadDocument(file, meta)
      }
    />
  );
}
