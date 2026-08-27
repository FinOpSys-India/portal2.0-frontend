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
}: {
  /** Query param this pill owns, e.g. "company". */
  param: string;
  /** The cleared state, shown when the param is absent. */
  all: PillOption;
  options: PillOption[];
  label: string;
  menuLabel: string;
  variant?: "default" | "outline";
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
};

function Pill({
  param,
  all,
  options,
  activeId,
  label,
  menuLabel,
  variant,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Read the live query rather than the hook: pages carry other params
   * alongside this one — Connect has channel and party, Files has both company
   * and project — and the Suspense fallback renders before useSearchParams
   * resolves. Replacing the whole query string would drop them.
   */
  function hrefFor(id: string) {
    const query = new URLSearchParams(window.location.search);
    if (id) query.set(param, id);
    else query.delete(param);
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
