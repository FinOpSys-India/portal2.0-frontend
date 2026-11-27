"use client";

import * as React from "react";

import { api } from "@/lib/api";

/**
 * Clears the session the backend has already stopped honoring.
 *
 * The cookies are HttpOnly, so only `api.logout` (via /login/logout) can
 * expire them. Left in place, the access cookie would keep bouncing /login back
 * to a portal that refuses every request.
 */
export function EndSession() {
  React.useEffect(() => {
    void api.logout();
  }, []);

  return null;
}
