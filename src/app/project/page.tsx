import { redirect } from "next/navigation";

/**
 * 1.0's project route, where lib/api.ts lands verified specialists. Forwards
 * into the rebuilt specialist portal so the login flow does not dead-end.
 *
 * It used to forward into the customer portal, which was a stopgap from before
 * the specialist portal existed — a specialist landing there saw somebody
 * else's workspace.
 */
export default function LegacyProjectLanding() {
  redirect("/specialist/projects");
}
