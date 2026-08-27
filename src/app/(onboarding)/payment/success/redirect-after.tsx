"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Carries a paid customer on to the workspace picker without a click.
 *
 * `replace`, not `push`: the entry it would leave in the history stack is a
 * URL carrying a spent Stripe session id, and Back landing on it would re-run
 * the status lookup and show a payment screen to someone who has finished
 * paying. Replacing means Back goes where they came from.
 *
 * Rendered only for `paid`. `processing` keeps its button — the subscription
 * is not live yet, so sending them into a workspace the backend still treats
 * as unpaid would bounce them straight back out.
 */
export function RedirectAfter({
  to,
  seconds = 4,
}: {
  to: string;
  seconds?: number;
}) {
  const router = useRouter();

  React.useEffect(() => {
    const timer = setTimeout(() => router.replace(to), seconds * 1000);
    return () => clearTimeout(timer);
  }, [router, to, seconds]);

  return null;
}
