/**
 * The portal role gate. Run: npx tsx src/proxy.test.ts
 *
 * The backend origin is set before the dynamic imports below rather than with a
 * static one, which would hoist above the assignment: `backend.ts` reads the
 * variable at module scope.
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

  const visit = (pathname: string, token?: string, csrf = false) =>
    proxy(
      new NextRequest(`http://localhost:5173${pathname}`, {
        headers: {
          cookie: [token && `accessToken=${token}`, csrf && "csrfToken=abc"]
            .filter(Boolean)
            .join("; "),
        },
      }),
    ).headers.get("location");

  const at = (path: string) => `http://localhost:5173${path}`;

  // No cookies at all is a genuinely signed-out visitor, and still the login screen.
  assert.equal(visit("/manager/projects"), at("/login"));

  // The auto-logout this route exists for: the access cookie expires with its
  // token, so an idle tab's next click arrives without one. A csrfToken means
  // there is a refresh cookie behind it, so the session continues through the
  // hop instead of ending — and comes back to the page that was asked for.
  assert.equal(
    visit("/manager/projects", undefined, true),
    at("/login/refresh?next=%2Fmanager%2Fprojects"),
  );
  assert.equal(
    visit("/manager/projects?tab=open", undefined, true),
    at("/login/refresh?next=%2Fmanager%2Fprojects%3Ftab%3Dopen"),
  );

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
