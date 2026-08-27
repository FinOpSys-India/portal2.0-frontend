"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The last line of defence for a failed render.
 *
 * A 401 never reaches here — `lib/http.ts` turns that into a redirect to the
 * login screen, which is the only failure with an obvious remedy. What lands
 * here is everything else: a 402 from the paywall, a 403, a backend that is
 * down, a shape that did not parse. Before this existed all of them rendered
 * Next's raw error overlay with a stack trace, which tells a user nothing and
 * shows them rather more than it should.
 *
 * `reset()` re-renders the segment rather than reloading the page, so a
 * transient failure costs one click.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // The digest is what correlates this with the server log; the message is
    // stripped in production builds and the digest is all there is.
    console.error("Render failed:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "The page could not be loaded."}
        </p>

        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
