import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/backend";

/**
 * Expire the session cookies on this origin, whatever the backend did.
 *
 * `POST /auth/logout` revokes the refresh-token family server-side, and
 * `api.logout` swallows its failure so the button can never hang. That left a
 * hole: the revoke is a call to a backend that times out under load, and the
 * refresh cookie is HttpOnly — `clearAccessToken` cannot touch it from script.
 * So a failed revoke left a live 30-day refresh cookie in the browser, the
 * proxy's next refresh hop spent it, and the PREVIOUS user was signed back in.
 * Signing in as the accounting manager landed on the admin portal that way.
 *
 * Under `/login` deliberately: the proxy's matcher excludes that prefix, so
 * this route answers even once the access cookie is gone — which is exactly
 * when it is needed. Anywhere else, a request with no access cookie would be
 * redirected to /login/refresh and restore the session it came to end.
 */
export async function POST() {
  const response = new NextResponse(null, { status: 204 });

  for (const name of [ACCESS_TOKEN_COOKIE, CSRF_COOKIE, REFRESH_TOKEN_COOKIE]) {
    // Same name and path the backend set it under; the browser matches on
    // those, and an empty value with Max-Age 0 is a delete.
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }

  return response;
}
