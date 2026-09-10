import { NextResponse } from "next/server";

import { drain } from "@/lib/dev-calls";

/**
 * The backend GETs the last server render made, for the dev network echo.
 *
 * 404s outside development rather than answering an empty list: the route only
 * exists to support a dev tool, and a live endpoint that names internal API
 * paths is not something to ship, however harmless the list looks.
 */
export function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json(
    { paths: drain() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
