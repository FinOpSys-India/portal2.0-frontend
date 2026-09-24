"use client";

import * as React from "react";

import { NotificationBell } from "@/components/portal/portal-chrome";
import { unreadThreads } from "@/lib/chat";
import { dayLabel } from "@/lib/manager";

/**
 * The notification bell, fetched ONCE PER SESSION rather than once per page.
 *
 * It used to be an async server component in each portal's layout, and a server
 * component re-renders on every navigation — so every page paid for the bell's
 * sweep, which is one request per company on the reader's book. The thirty
 * second data cache blunted that, but any write clears the tag, so a reader who
 * is actually using chat paid it again and again.
 *
 * A CLIENT component in the layout does not re-render on navigation: it mounts
 * once and survives every page change under that layout. So the sweep happens
 * on mount and then on a timer of its own, whatever the reader clicks.
 *
 * REFRESHED ON A TIMER, not on navigation, which is also the behaviour a bell
 * should have had anyway — sitting on one page for ten minutes used to show a
 * count frozen at whatever it was when the page loaded.
 *
 * Starts empty and fills in. The bell renders immediately with no count, which
 * is what the Suspense fallback did before, so the frame is never held up.
 */
const REFRESH_MS = 60_000;

export function LiveBell({
  companies,
  hrefFor,
}: {
  companies: { id: string; name: string }[];
  /** Built here rather than passed as a function: a portal decides its own URL shape. */
  hrefFor: "customer" | "specialist";
}) {
  const [items, setItems] = React.useState<
    React.ComponentProps<typeof NotificationBell>["items"]
  >([]);

  /*
   * Keyed on the ids, not the array. A fresh array arrives from the layout on
   * every render and would restart the effect each time, which is the very
   * thing this component exists to stop.
   */
  const key = companies.map((c) => c.id).join(",");

  React.useEffect(() => {
    let live = true;

    const load = () => {
      unreadThreads(companies)
        .then((threads) => {
          if (!live) return;
          setItems(
            threads.map((t) => ({
              id: t.conversationId,
              href:
                hrefFor === "customer"
                  ? `/customer/${encodeURIComponent(t.companyId)}/connect/chat`
                  : `/specialist/connect/chat?company=${encodeURIComponent(t.companyId)}`,
              company: t.company,
              contact: t.contact,
              preview: t.preview,
              unread: t.unread,
              when: t.at ? dayLabel(t.at) : "",
            })),
          );
        })
        // Swallowed: a bell that cannot load is empty, not an error boundary.
        // An unpaid account 402s here and the rest of the portal is fine.
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      live = false;
      clearInterval(timer);
    };
    // `companies` is covered by `key`; see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hrefFor]);

  return <NotificationBell items={items} />;
}
