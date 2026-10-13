"use client";

import { UploadFile, type UploadMeta } from "@/components/portal/upload-file";
import { specialistApi } from "@/lib/specialist";

export function SpecialistUploadFile({
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
        specialistApi.uploadDocument(file, meta)
      }
    />
  );
}
