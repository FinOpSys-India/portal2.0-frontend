import { redirect } from "next/navigation";

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
 */
export default function HomePage() {
  redirect("/login");
}
