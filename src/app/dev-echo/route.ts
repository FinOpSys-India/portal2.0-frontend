import { NextResponse } from "next/server";

import { ECHO_ENABLED, drain } from "@/lib/dev-calls";

/**
 * The backend GETs the last server render made, for the network echo.
 *
 * 404s when the echo is off rather than answering an empty list: the route only
 * exists to support the panel, and a live endpoint that names internal API
 * paths is not something to leave standing, however harmless the list looks.
 *
 * NOT UNDER `__dev/`, WHICH IS WHERE IT USED TO SIT AND WHY IT NEVER RAN. Next
 * treats an underscore-prefixed folder as private and opts it and everything
 * below it out of routing, so `/__dev/calls` 404d in development too — the echo
 * fetched it, got a not-ok response, and returned without replaying anything.
 * Any rename of this folder has to stay clear of a leading underscore, and of
 * `/api`, which src/proxy.ts forwards to the backend.
 */
export function GET() {
  if (!ECHO_ENABLED) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json(
    { paths: drain() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
