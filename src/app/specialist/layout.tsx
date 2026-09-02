import type { Metadata } from "next";

import { SpecialistShell } from "@/components/specialist/specialist-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
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
    /*
     * Same reason the manager's bell and the customer's unread count swallow
     * theirs: this is one number in the top bar, and awaited hard it can take
     * every specialist route down with it when chat times out.
     */
    specialistApi.thread().catch(() => ({ id: null, contact: "", unread: 0 })),
  ]);

  return (
    <SpecialistShell
      user={{ name: profile.name, email: profile.email }}
      companies={companies.map(({ id, name }) => ({ id, name }))}
      // One counterparty, so the bell counts the one thread that exists.
      notifications={<NotificationBell count={thread.unread} />}
    >
      {children}
    </SpecialistShell>
  );
}
