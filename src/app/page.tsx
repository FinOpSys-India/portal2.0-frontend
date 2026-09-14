import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { landingPathForRole } from "@/lib/api";
import { ACCESS_TOKEN_COOKIE } from "@/lib/backend";
import { roleFromToken } from "@/lib/session";

/**
 * Root is the login screen.
 *
 * It used to be a portal picker — four cards, one per role — which asked a
 * visitor to answer a question the session already answers: signing in resolves
 * a role and lands on the right portal by itself. The cards were a shortcut for
 * whoever was already signed in, and a dead end for everyone else.
 *
 * A redirect rather than the form rendered here, so `/login` stays the one URL
 * for signing in. Every existing link, the proxy's own guard, and the logout
 * hop already point at it; a second copy at `/` would be a second page to keep
 * in step.
 *
 * WITH A SESSION IT IS THE PORTAL INSTEAD. `/` is the address someone types,
 * bookmarks, and lands on from the logo — and sending a signed-in person to the
 * sign-in form there is the same wrong turn the back button used to take. The
 * proxy would bounce them off /login anyway; going straight home saves the
 * extra hop. Role only, never onboarding state: that needs a backend read, and
 * this runs before any page has rendered.
 */
export default async function HomePage() {
  const role = roleFromToken((await cookies()).get(ACCESS_TOKEN_COOKIE)?.value);
  redirect(role ? landingPathForRole(role) : "/login");
}
