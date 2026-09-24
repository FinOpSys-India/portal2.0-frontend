import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/backend";

/**
 * Turn the access token from a login response BODY into an HttpOnly cookie.
 *
 * The backend hands the access token back as JSON, not as a Set-Cookie — so
 * something on this side has to park it where src/proxy.ts can read it back and
 * spend it as a bearer header. That used to be `document.cookie`, which meant
 * the cookie could not be HttpOnly: a cookie written by script is readable by
 * script, and so by anything that ever gets to run on the page. A bearer token
 * for a financial portal sat in `document.cookie` for any XSS, any compromised
 * dependency, any pasted console snippet to lift.
 *
 * A cookie set from a RESPONSE can be HttpOnly, which is the whole reason this
 * route exists. It is the same trick, and the same neighbourhood, as
 * ../logout/route.ts — under `/login` deliberately, because the proxy's matcher
 * excludes that prefix, so this answers while there is no access cookie yet,
 * which is exactly when it is called.
 *
 * NOTE THIS DOES NOT MAKE THE TOKEN SECRET FROM THE PAGE. The client still
 * receives it in the login response it just read; what changes is that it stops
 * being PERSISTED somewhere script can go back to later. An XSS now has to be
 * running at the moment of a login or a refresh to catch one, instead of
 * reading whatever is lying in the cookie jar.
 */
export async function POST(request: NextRequest) {
  /*
   * Same-origin only, so this cannot be used to plant a session.
   *
   * Setting a cookie is a write, and the cookie being written is WHO YOU ARE:
   * an attacker who could make your browser POST here would hand you their
   * token and then watch you work inside their account. A JSON content-type
   * already puts this out of reach of a cross-origin form post and into
   * preflight, which has no CORS headers to pass — this is the explicit second
   * lock, because the cost of it is one comparison.
   *
   * COMPARED AGAINST THE HOST HEADER, NOT `request.nextUrl.origin`. Behind a
   * reverse proxy those are different things: `next start` builds the URL every
   * NextRequest derives from out of the hostname and port it LISTENS on, so
   * nextUrl.origin reads `http://localhost:5051` while the browser sends the
   * public address. Every login then 403s. Only the scheme survives the hop
   * (via x-forwarded-proto); the host has to be read from the forwarded header.
   * This is what Next itself compares for the same CSRF check on Server
   * Actions — see `x-forwarded-host` in its action handler.
   *
   * Host and port only, no scheme: the proxy terminates TLS, so the origin is
   * https while everything this side sees is http.
   */
  const origin = request.headers.get("origin");
  if (origin) {
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    // No host at all is refused rather than waved through: without it there is
    // nothing to compare the Origin to, so the lock is not shut, it is absent.
    if (!host || parseHost(origin) !== host) {
      return new NextResponse(null, { status: 403 });
    }
  }

  const body = await request.json().catch(() => null);
  const token = body?.token;
  if (typeof token !== "string" || token === "") {
    return new NextResponse(null, { status: 400 });
  }

  /*
   * A non-positive lifetime is REFUSED rather than written.
   *
   * `Max-Age=0` is a delete, so a token that arrives already expired — clock
   * skew, a backend handing out a zero lifetime — would set nothing at all and
   * report success. The proxy would then send the next navigation to
   * /login/refresh, which would refresh, store nothing, and bounce again:
   * proxy → refresh → proxy, forever. Saying 400 here is what lets the caller
   * give up and go to /login after one pass. This replaces the read-back of
   * `document.cookie` the refresh page used to do, which HttpOnly makes
   * impossible and which was only ever checking for this.
   */
  const lifetime = body?.expiresInSeconds;
  const maxAge = Math.floor(typeof lifetime === "number" ? lifetime : 900);
  if (!Number.isFinite(maxAge) || maxAge <= 0) {
    return new NextResponse(null, { status: 400 });
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(ACCESS_TOKEN_COOKIE, token, {
    path: "/",
    maxAge,
    httpOnly: true,
    sameSite: "lax",
    // Not hard-coded true: a production build served over plain HTTP for an
    // internal test would set a cookie the browser then refuses to send back,
    // and the whole portal would read as signed out with nothing to explain it.
    secure:
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
  });
  return response;
}

/** The `host:port` of an Origin header, or null if it is not a URL at all. */
function parseHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
