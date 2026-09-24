import type { Metadata } from "next";

import { Suspense } from "react";

import { SpecialistShell } from "@/components/specialist/specialist-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { unreadThreads } from "@/lib/chat";
import { dayLabel } from "@/lib/manager";
import { myProfile } from "@/lib/portal";
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
async function UnreadBell({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const threads = await unreadThreads(companies).catch(() => []);

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
  /*
   * `myProfile`, NOT `specialistApi.profile()`. That boundary pairs /users/me
   * with an UNSCOPED project sweep — one request per company — to count the
   * specialist's active projects, and the frame draws a name, an email and a
   * picture. The count belongs to /specialist/profile, which is the page that
   * shows it; paying for it on all eleven specialist pages bought nothing.
   */
  const [profile, companies] = await Promise.all([
    myProfile(),
    specialistApi.companies(),
  ]);

  // The bell's list is built from these same rows rather than fetching them
  // again: it used to call `companies()` itself, which the data cache absorbed
  // on a warm read and re-issued on the first render after any write.
  const forBell = companies.map(({ id, name }) => ({ id, name }));

  return (
    <SpecialistShell
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
      companies={forBell}
      /*
       * Behind a boundary for the same reason the manager's is: this is one
       * request per company for a dropdown, and the nav must not wait on it.
       */
      notifications={
        <Suspense fallback={<NotificationBell />}>
          <UnreadBell companies={forBell} />
        </Suspense>
      }
    >
      {children}
    </SpecialistShell>
  );
}
