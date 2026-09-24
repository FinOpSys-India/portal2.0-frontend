import type { Metadata } from "next";

import { SpecialistShell } from "@/components/specialist/specialist-shell";
import { LiveBell } from "@/components/portal/live-bell";
import { myProfile } from "@/lib/portal";
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
      // A client component, so it mounts once and survives every navigation
      // under this layout instead of sweeping again on each one. See LiveBell.
      notifications={<LiveBell companies={forBell} hrefFor="specialist" />}
    >
      {children}
    </SpecialistShell>
  );
}
