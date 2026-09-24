/**
 * The route that turns a login response into an HttpOnly session cookie.
 * Run: npx tsx "src/app/(auth)/login/session/route.test.ts"
 *
 * Worth a test because both of its failure modes are silent. Drop the HttpOnly
 * flag and nothing breaks — the portal works perfectly and the bearer token is
 * back in `document.cookie` for any script to take. Accept a non-positive
 * lifetime and the cookie is never really set, which the proxy answers by
 * redirecting to /login/refresh, which lands back here: a redirect loop with no
 * error anywhere in it.
 */
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_API_URL = "https://backend.example";

async function main() {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("./route");

  const ORIGIN = "https://portal.example";
  const call = (body: unknown, headers: Record<string, string> = {}) =>
    POST(
      new NextRequest(`${ORIGIN}/login/session`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    );

  /* ------------------------------------------------ the happy path ------ */

  const ok = await call({ token: "jwt.abc.def", expiresInSeconds: 900 });
  assert.equal(ok.status, 204);

  const set = ok.cookies.get("accessToken");
  assert.equal(set?.value, "jwt.abc.def");
  assert.equal(set?.maxAge, 900);
  assert.equal(set?.path, "/");
  assert.equal(set?.sameSite, "lax");

  // The entire point of the route. If this ever reads false, the token is
  // readable from `document.cookie` again and the change has been undone.
  assert.equal(set?.httpOnly, true, "the access cookie MUST be HttpOnly");
  assert.equal(set?.secure, true, "https request must set a Secure cookie");

  /* ------------------------ a dead lifetime is refused, not written ----- */

  for (const bad of [0, -1]) {
    const res = await call({ token: "jwt.abc.def", expiresInSeconds: bad });
    assert.equal(res.status, 400, `expiresInSeconds ${bad} must be refused`);
    assert.equal(
      res.cookies.get("accessToken"),
      undefined,
      "a refused lifetime must not set a cookie at all",
    );
  }

  // Infinity, which is why the guard tests `Number.isFinite` and not just the
  // sign. It cannot be written with `JSON.stringify` — that turns it into null
  // — but it parses straight out of a numeric literal that overflows, so it is
  // reachable from a real response body. `Max-Age=Infinity` is not a number the
  // browser will take, and the cookie would simply not be set.
  const overflowed = await POST(
    new NextRequest(`${ORIGIN}/login/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"token":"jwt.abc.def","expiresInSeconds":1e999}',
    }),
  );
  assert.equal(overflowed.status, 400, "an infinite lifetime must be refused");
  assert.equal(overflowed.cookies.get("accessToken"), undefined);

  // Absent is not the same as invalid: no lifetime falls back to the token's
  // usual ~15 minutes rather than failing the sign-in.
  const fallback = await call({ token: "jwt.abc.def" });
  assert.equal(fallback.status, 204);
  assert.equal(fallback.cookies.get("accessToken")?.maxAge, 900);

  /* ----------------------------------------- no token, no cookie -------- */

  for (const bad of [{}, { token: "" }, { token: 42 }]) {
    assert.equal((await call(bad)).status, 400, `${JSON.stringify(bad)} refused`);
  }

  /* ------------------------------- cross-origin cannot plant a session -- */

  // Session fixation: if another origin could drive this, it would hand the
  // victim ITS token and then read whatever the victim did inside its account.
  const foreign = await call(
    { token: "attacker.token", expiresInSeconds: 900 },
    { origin: "https://evil.example" },
  );
  assert.equal(foreign.status, 403, "a foreign Origin must be refused");
  assert.equal(foreign.cookies.get("accessToken"), undefined);

  // Same-origin sends an Origin too, and must still work.
  const same = await call(
    { token: "jwt.abc.def", expiresInSeconds: 900 },
    { origin: ORIGIN },
  );
  assert.equal(same.status, 204, "our own Origin is fine");

  /* ---------------------------------- plain http gets a usable cookie --- */

  // Not `secure: true` unconditionally: over http the browser would refuse to
  // send it back and the portal would read as permanently signed out.
  const insecure = await POST(
    new NextRequest("http://localhost:5173/login/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "jwt.abc.def", expiresInSeconds: 900 }),
    }),
  );
  assert.equal(insecure.cookies.get("accessToken")?.secure, false);

  console.log("login/session route: all checks passed");
}

main();
