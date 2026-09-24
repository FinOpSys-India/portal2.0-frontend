import Link from "next/link";
import { UserRoundSearch } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * What the chat pane shows before the company has an accounting manager.
 *
 * The thread cannot exist yet — it is (company, manager, counterpart), and one
 * of the three is unfilled — so there is nothing to render and nothing to send.
 * Said plainly here rather than left to the error boundary: waiting on staffing
 * is a normal state of a new company, not a fault, and "Something Went Wrong"
 * over it tells the reader their portal is broken when it is working.
 */
export function NoManagerYet({ backHref }: { backHref: string }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <UserRoundSearch
        className="size-10 text-muted-foreground"
        aria-hidden
      />
      <h2 className="mt-4 text-lg font-semibold">
        Your accounting manager is on the way
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We haven&apos;t assigned one to your company just yet. As soon as your
        accounting manager is in place, this is where you&apos;ll be able to
        chat with them. Thank you for your patience.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href={backHref}>Go back</Link>
      </Button>
    </section>
  );
}
