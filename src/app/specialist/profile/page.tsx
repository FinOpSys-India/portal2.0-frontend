import type { Metadata } from "next";

import { AvatarUpload } from "@/components/portal/avatar-upload";
import { PageHeader } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { myProfile } from "@/lib/portal";
import { specialistApi } from "@/lib/specialist";

export const metadata: Metadata = { title: "Profile" };

/**
 * Profile — the same two sections and profile card every portal shows.
 *
 * EDITABLE, and it saves, through the form the manager's and the customer's
 * screens already use. 1.0 renders these as inputs with no Save button anywhere
 * on the page (docs/am-portal.md), so an edit is silently discarded; this port
 * commits phone and address with `PATCH /users/me` — the one record the admin's
 * and the manager's screens read this person off too.
 *
 * Two reads of `/users/me`, not one: the form takes the address SPLIT into its
 * columns, and `specialistApi.profile` joins it into a line for the cards that
 * render one. Server GETs are served from the per-session data cache, so the
 * second costs no round trip.
 */
export default async function SpecialistProfilePage() {
  const [me, specialist] = await Promise.all([
    myProfile(),
    specialistApi.profile(),
  ]);

  return (
    <>
      {/* "Profile", as the tab title, the sidebar, the manager's copy of this
          page and the customer portal all call it. One name for one screen,
          whichever portal you are signed in to. */}
      <PageHeader title="Profile" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* The speciality is read-only here for the same reason the name is:
            it is the role the account was created under, not the holder's to
            rewrite — `PATCH /users/me` takes phone and address and nothing
            else. */}
        <ProfileForm profile={me} role={specialist.speciality} />

        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 lg:self-start">
          {/* Its own write, to its own endpoint — see the note in
              ProfileForm on why it is not inside the form. */}
          <AvatarUpload name={me.fullName} avatarUrl={me.avatarUrl} />
          <div className="text-center">
            <p className="font-semibold">{me.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {specialist.speciality}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
