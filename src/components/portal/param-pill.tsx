"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  WorkspacePill,
  type PillOption,
} from "@/components/portal/workspace-pill";

/**
 * A pill that writes its choice into one query param.
 *
 * Scope lives in the URL rather than in state, so a reload cannot silently
 * show a different company's — or a different project's — data, and a link
 * carries what the sender was looking at.
 */
export function ParamPill({
  param,
  all,
  options,
  label,
  menuLabel,
  variant,
  keep,
}: {
  /** Query param this pill owns, e.g. "company". */
  param: string;
  /** The cleared state, shown when the param is absent. */
  all: PillOption;
  options: PillOption[];
  label: string;
  menuLabel: string;
  variant?: "default" | "outline";
  /**
   * The other query params that survive a change, besides this pill's own.
   *
   * Everything else on the URL describes the scope being LEFT — which page of
   * it, which filters, which of its projects, which of its conversations — and
   * carrying that over is how switching company lands on an empty table under a
   * filter pill that says "All". Naming what travels rather than what does not
   * means a param added later has to be thought about once.
   */
  keep: string[];
}) {
  const items = [all, ...options];

  return (
    // useSearchParams client-side renders everything up to the nearest
    // boundary; without this the whole portal shell deopts out of
    // prerendering, and the production build fails outright.
    <Suspense
      fallback={
        <Pill
          param={param}
          all={all}
          options={items}
          activeId=""
          label={label}
          menuLabel={menuLabel}
          variant={variant}
          keep={keep}
        />
      }
    >
      <Active
        param={param}
        all={all}
        options={items}
        label={label}
        menuLabel={menuLabel}
        variant={variant}
        keep={keep}
      />
    </Suspense>
  );
}

function Active(props: Omit<Props, "activeId">) {
  return (
    <Pill {...props} activeId={useSearchParams().get(props.param) ?? ""} />
  );
}

type Props = {
  param: string;
  all: PillOption;
  options: PillOption[];
  activeId: string;
  label: string;
  menuLabel: string;
  variant?: "default" | "outline";
  keep: string[];
};

function Pill({
  param,
  all,
  options,
  activeId,
  label,
  menuLabel,
  variant,
  keep,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Read the live query rather than the hook: pages carry other params
   * alongside this one — Connect has party, Files has both company and project
   * — and the Suspense fallback renders before useSearchParams resolves.
   *
   * Rebuilt from `keep` rather than edited in place. Kept in place, a page
   * number, a filter set or a project name picked under the old scope rode
   * along into the new one, where it names nothing: Documents came up empty
   * under a project pill reading "All projects", and page 3 of an eight-row
   * table came up blank.
   */
  function hrefFor(id: string) {
    const live = new URLSearchParams(window.location.search);
    const query = new URLSearchParams();
    for (const name of keep) {
      for (const value of live.getAll(name)) query.append(name, value);
    }
    if (id) query.set(param, id);
    const rest = query.toString();
    return rest ? `${pathname}?${rest}` : pathname;
  }

  return (
    <WorkspacePill
      // An id that no longer exists falls back to the cleared state rather
      // than rendering an empty pill.
      current={options.find((o) => o.id === activeId) ?? all}
      options={options}
      label={label}
      menuLabel={menuLabel}
      variant={variant}
      onSelect={(id) => router.push(hrefFor(id))}
    />
  );
}
