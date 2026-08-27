import { redirect } from "next/navigation";

/**
 * The address the backend actually emails.
 *
 * `invitationService.deliver` builds `<FRONTEND_URL>/accept-invitation?token=…`
 * and nothing here answered it, so every invitation link 404'd and no account
 * could be created at all. The sign-up screen lives at `/signup_2938` for 1.0
 * parity, so this forwards rather than duplicating the form.
 *
 * The email carries only the token. `POST /auth/signup` also requires the
 * address and both names, and there is no public endpoint that resolves a
 * token into the person it was issued to — `GET /invitations` needs an
 * authenticated inviter, which someone signing up is not. So they are collected
 * on the form instead, and any that the link does supply are passed straight
 * through.
 */
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const key of ["token", "email", "firstName", "lastName"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }

  redirect(`/signup_2938?${query.toString()}`);
}
