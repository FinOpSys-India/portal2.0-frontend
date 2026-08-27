import { redirect } from "next/navigation";

/**
 * 1.0's admin landing route. lib/api.ts sends verified admins here, so it
 * forwards to the rebuilt portal rather than 404ing mid-login.
 */
export default function LegacyAdminLanding() {
  redirect("/admin/customers");
}
