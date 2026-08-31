/**
 * The portal role gate. Run: npx tsx src/proxy.test.ts
 *
 * The backend is configured here (and nowhere else in the suite) because the
 * gate only arms when `LIVE` is true — in mock mode there is no session to
 * check and every page stays open. `backend.ts` reads the variable at module
 * scope, so it is set before the dynamic imports below and not with a static
 * one, which would hoist above the assignment.
 */
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_API_URL = "https://backend.example";

/** An access token carrying nothing but the claim the proxy reads. */
function tokenFor(role: string): string {
  const payload = Buffer.from(JSON.stringify({ role, sub: 1 })).toString(
    "base64url",
  );
  return `header.${payload}.signature`;
}

async function main() {
  const { NextRequest } = await import("next/server");
  const { proxy } = await import("./proxy");

  const visit = (pathname: string, token?: string) =>
    proxy(
      new NextRequest(`http://localhost:5173${pathname}`, {
        headers: token ? { cookie: `accessToken=${token}` } : {},
      }),
    ).headers.get("location");

  const at = (path: string) => `http://localhost:5173${path}`;

  // Signed out is still the first gate, and it is unchanged.
  assert.equal(visit("/manager/projects"), at("/login"));

  // The role that owns the portal passes through.
  assert.equal(visit("/manager/projects", tokenFor("ACCOUNTING_MANAGER")), null);

  // The regression this exists for: a signed-in non-manager used to render the
  // manager layout, take a 403 from /accounting-manager/companies, and get
  // "Something went wrong" on every route under /manager.
  assert.equal(visit("/manager/projects", tokenFor("CUSTOMER")), at("/comany_select"));
  assert.equal(visit("/manager", tokenFor("ADMIN")), at("/list_of_customers"));
  assert.equal(visit("/admin/customers", tokenFor("SPECIALIST")), at("/project"));

  // An unreadable claim is left alone rather than guessed at — the backend is
  // still the thing that decides.
  assert.equal(visit("/manager/projects", "not-a-jwt"), null);
  assert.equal(visit("/manager/projects", tokenFor("NONSENSE")), null);

  // Shared 1.0 routes belong to no portal and stay open to any session.
  assert.equal(visit("/list_of_customers", tokenFor("CUSTOMER")), null);

  // A prefix is a segment, not a substring.
  assert.equal(visit("/customer-support", tokenFor("ADMIN")), null);

  console.log("proxy.test.ts: all assertions passed");
}

main();
