/**
 * The portal role gate. Run: npx tsx src/proxy.test.ts
 *
 * The backend origin is set before the dynamic imports below rather than with a
 * static one, which would hoist above the assignment: `backend.ts` reads the
 * variable at module scope.
 */
import assert from "node:assert/strict";
import { safeNextPath } from "@/lib/session";

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
  assert.equal(visit("/manager/projects", tokenFor("CUSTOMER")), at("/company_select"));
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

  /* ------------------------------------------------ back into sign-in ---- */

  // The bug this exists for: signing in left /login and the OTP screen in
  // history behind the portal, so pressing Back far enough walked out of the
  // app and into a login form — with a challenge that had already been spent.
  // A live session on one of those screens goes home instead.
  assert.equal(visit("/login", tokenFor("ACCOUNTING_MANAGER")), at("/manager"));
  assert.equal(visit("/otp_page_login", tokenFor("CUSTOMER")), at("/company_select"));
  assert.equal(visit("/signup_2938", tokenFor("ADMIN")), at("/list_of_customers"));
  assert.equal(visit("/login-v1", tokenFor("SPECIALIST")), at("/project"));

  // Signed OUT, these are the screens to be on. Bouncing them would be a
  // redirect to itself — and a csrfToken must not send them through the
  // refresh hop either, since that hop's own destination is /login.
  assert.equal(visit("/login"), null);
  assert.equal(visit("/otp_page_login", undefined, true), null);
  assert.equal(visit("/login", "not-a-jwt"), null);

  // NOT bounced: the refresh hop is reached without an access cookie by
  // definition, and both of these are errands a signed-in person can be on.
  assert.equal(visit("/login/refresh", tokenFor("CUSTOMER")), null);
  assert.equal(visit("/forgot_password", tokenFor("CUSTOMER")), null);
  assert.equal(visit("/accept-invitation", tokenFor("CUSTOMER")), null);

  console.log("proxy.test.ts: all assertions passed");
}

main();

/* ------------------------------------------- ?next= cannot leave the site -- */

/*
 * The proxy MINTS `?next=` (it redirects a cookie-less navigation to
 * /login/refresh carrying where the user was going) and the refresh page spends
 * it on `location.replace`. So the value makes a round trip through the URL bar
 * and is attacker-supplied by the time it comes back — an open redirect anyone
 * can aim by sending a link to a portal user whose access cookie has lapsed,
 * which is the ordinary state after ~15 idle minutes.
 *
 * `/\evil.example` is the case a `startsWith("//")` test misses: browsers
 * parsing a special scheme treat a backslash in the authority as a slash.
 */
{
  const ORIGIN = "https://portal.example";
  const to = (next: string) =>
    safeNextPath(`?next=${encodeURIComponent(next)}`, ORIGIN);

  assert.equal(to("/admin/companies/42"), "/admin/companies/42", "a real path is kept");
  assert.equal(to("/list_of_customers?page=2"), "/list_of_customers?page=2", "query rides along");

  assert.equal(to("//evil.example"), "/", "protocol-relative is refused");
  assert.equal(to("/\\evil.example"), "/", "backslash authority is refused");
  assert.equal(to("https://evil.example/x"), "/", "absolute off-origin is refused");
  assert.equal(to("javascript:alert(1)"), "/", "javascript: is refused");
  assert.equal(safeNextPath("", ORIGIN), "/", "no next at all lands home");

  // The guard is the parse, so this holds without enumerating forms: whatever
  // the browser would resolve to another origin is dropped.
  for (const hostile of ["//evil.example", "/\\evil.example", "https://evil.example/x"]) {
    assert.notEqual(
      new URL(to(hostile), ORIGIN).origin,
      new URL(hostile, ORIGIN).origin,
      `${hostile} must not survive as an off-origin target`,
    );
  }
}
