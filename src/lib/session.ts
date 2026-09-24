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

/**
 * The path to continue to after a session refresh, from an untrusted `?next=`.
 *
 * STRING PREFIX TESTS CANNOT DO THIS, which is what the previous version tried:
 * it took anything starting with `/` that did not start with `//`, reasoning
 * that `//evil.example` is the protocol-relative form that would leave the
 * site. It is — but it is not the only one. Browsers parsing a special scheme
 * fold a backslash to a slash in the authority position, so `/\evil.example`
 * passes that guard and `location.replace` still lands on `https://evil.example`.
 * An expired session is then a redirect anyone can aim by sending a link.
 *
 * So the check is the parse itself, against the same URL machinery the browser
 * will use on the value: resolve it and keep it only if it stayed on this
 * origin. That covers the backslash form, an absolute `https://evil.example`,
 * and `javascript:` (whose origin is `null`) without enumerating any of them.
 *
 * Takes `search` and `origin` rather than reading `window` so it can be tested.
 */
export function safeNextPath(search: string, origin: string): string {
  const next = new URLSearchParams(search).get("next");
  if (!next) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
