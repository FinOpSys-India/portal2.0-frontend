"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const KEY = "portal:company";

/**
 * Remember which company the reader was scoped to, across a reload.
 *
 * The scope itself lives in `?company=` and stays there — it is shareable, the
 * back button understands it, and the server reads it straight off the URL.
 * What the URL cannot do is survive closing the tab, and unscoped is the
 * expensive state: `overCompanies` asks the backend once per company when no id
 * is given, so an eight-company manager landing unscoped pays eight round trips
 * for a table they were going to narrow to one anyway.
 *
 * sessionStorage rather than localStorage, deliberately. The scope is a working
 * position, not a setting; it belongs to this tab and this sitting, and a shared
 * machine should not greet the next person with the last one's client.
 *
 * ONLY RESTORES AN ID THE READER STILL HOLDS. `known` is the switcher's own
 * list, so an id left over from another account — or from a company since taken
 * off this manager — is dropped rather than replayed into a URL the backend
 * would refuse.
 */
export function ScopeMemory({ known }: { known: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current = params.get("company") ?? "";
  const query = params.toString();
  // Joined, because a fresh array every render would re-run this effect every
  // render — and the effect navigates.
  const allowed = known.join(",");

  useEffect(() => {
    if (current) {
      sessionStorage.setItem(KEY, current);
      return;
    }

    const remembered = sessionStorage.getItem(KEY);
    if (!remembered || !allowed.split(",").includes(remembered)) return;

    const next = new URLSearchParams(query);
    next.set("company", remembered);
    // `replace`, so restoring a scope does not put an entry in the history that
    // the back button then has to be pressed twice to get past.
    router.replace(`${pathname}?${next}`);
  }, [current, allowed, query, pathname, router]);

  return null;
}
