import type { Metadata } from "next";

import { SpecialistShell } from "@/components/specialist/specialist-shell";
import { specialistApi } from "@/lib/specialist";

export const metadata: Metadata = {
  title: {
    default: "Specialist – FinOpSys",
    template: "%s – Specialist – FinOpSys",
  },
};

export default async function SpecialistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, companies, thread] = await Promise.all([
    specialistApi.profile(),
    specialistApi.companies(),
    specialistApi.thread(),
  ]);

  return (
    <SpecialistShell
      user={{ name: profile.name, email: profile.email }}
      companies={companies.map(({ id, name }) => ({ id, name }))}
      // One counterparty, so the bell counts the one thread that exists.
      notificationCount={thread.unread}
    >
      {children}
    </SpecialistShell>
  );
}
