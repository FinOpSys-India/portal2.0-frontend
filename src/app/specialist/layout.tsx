import type { Metadata } from "next";

import { Suspense } from "react";

import { SpecialistShell } from "@/components/specialist/specialist-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { unreadThreads } from "@/lib/chat";
import { dayLabel } from "@/lib/manager";
import { specialistApi } from "@/lib/specialist";

export const metadata: Metadata = {
  title: {
    default: "Specialist – FinOpSys",
    template: "%s – Specialist – FinOpSys",
  },
};

/**
 * One thread per company, and a specialist works several.
 *
 * The bell used to count `specialistApi.thread()`, which resolves the FIRST
 * company only — a message from any other account was invisible in the chrome
 * until the reader happened to switch the header to it. Every company is swept
 * here, and each row is tagged with which one it came from.
 */
async function UnreadBell() {
  const companies = await specialistApi.companies().catch(() => []);
  const threads = await unreadThreads(
    companies.map(({ id, name }) => ({ id, name })),
  ).catch(() => []);

  return (
    <NotificationBell
      items={threads.map((t) => ({
        id: t.conversationId,
        // `?company=` is what decides WHICH thread the chat page opens.
        href: `/specialist/connect/chat?company=${encodeURIComponent(t.companyId)}`,
        company: t.company,
        contact: t.contact,
        preview: t.preview,
        unread: t.unread,
        when: t.at ? dayLabel(t.at) : "",
      }))}
    />
  );
}

export default async function SpecialistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, companies] = await Promise.all([
    specialistApi.profile(),
    specialistApi.companies(),
  ]);

  return (
    <SpecialistShell
      user={{ name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl }}
      companies={companies.map(({ id, name }) => ({ id, name }))}
      /*
       * Behind a boundary for the same reason the manager's is: this is one
       * request per company for a dropdown, and the nav must not wait on it.
       */
      notifications={
        <Suspense fallback={<NotificationBell />}>
          <UnreadBell />
        </Suspense>
      }
    >
      {children}
    </SpecialistShell>
  );
}
