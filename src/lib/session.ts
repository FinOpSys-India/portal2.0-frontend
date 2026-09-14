import type { Role } from "@/lib/api";

/** Roles we know a landing for — also the allowlist `roleFromToken` checks. */
const ROLES: Record<Role, true> = {
  ADMIN: true,
  ACCOUNTING_MANAGER: true,
  SPECIALIST: true,
  CUSTOMER: true,
};

/**
 * The `role` claim of an access token, read without verifying the signature.
 *
 * That is deliberate and it is not the authorization: the backend re-checks the
 * role on every request, against the DATABASE and not just the claim (see
 * `requireRole`). This only decides which page to show, so a forged claim buys
 * an attacker a portal that then 403s on its first fetch — exactly where they
 * started. Verifying here would mean shipping the signing key to the proxy.
 *
 * Its own module because two callers need it and neither can import the other:
 * src/proxy.ts runs at the edge, and the root page is a Server Component. A
 * type-only import of `Role` keeps this free of a runtime cycle back through
 * lib/api → lib/http → lib/backend.
 */
export function roleFromToken(token: string | undefined | null): Role | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const role = JSON.parse(json)?.role;
    return typeof role === "string" && role in ROLES ? (role as Role) : null;
  } catch {
    return null;
  }
}
