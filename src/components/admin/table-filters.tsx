"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Filter as FilterIcon,
  Hash,
  ListChecks,
  RotateCcw,
  Search,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  operatorLabel,
  rangeFilter,
  rangeValues,
  serializeFilter,
  type Filter,
  type FilterType,
} from "@/lib/table-filter";
import { cn } from "@/lib/utils";

/** One filterable column, as the table describes it to the bar. */
export type FilterField = {
  header: string;
  type: FilterType;
  /** The distinct values in the loaded rows. Enum columns only. */
  options?: string[];
};

/** The rail's icon per column type, so a field is recognisable before reading. */
const ICONS: Record<FilterType, LucideIcon> = {
  text: Type,
  enum: ListChecks,
  date: CalendarDays,
  number: Hash,
};

/**
 * Writes `?f=`, and nothing else.
 *
 * The filtering itself happens on the server, in the table. Keeping the URL as
 * the only thing these controls touch means one definition of what a filter
 * means, and a filtered list that can be linked, bookmarked and reloaded.
 *
 * Shared because the two halves of the bar are mounted in different places —
 * the button sits by the page's own action, the chips sit with the table — and
 * both write the same param.
 */
function useCommitFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return React.useCallback(
    (next: Filter[]) => {
      const params = new URLSearchParams(searchParams);
      params.delete("f");
      for (const filter of next) params.append("f", serializeFilter(filter));
      // A narrower list has fewer pages, so page 4 of the old list is usually
      // past the end of the new one.
      params.delete("page");

      const query = params.toString();
      // The table redraws in place; scrolling to the top would throw away the
      // reader's position in a long list.
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
}

/**
 * What is filtering now, as removable chips.
 *
 * WITH THE TABLE, not with the button that made them. A chip is a statement
 * about the rows below it — "these are the ones left" — so it belongs against
 * them; the control that opens the panel belongs with the page's other verbs.
 */
export function FilterChips({
  fields,
  filters,
}: {
  fields: FilterField[];
  filters: Filter[];
}) {
  const commit = useCommitFilters();

  if (filters.length === 0) return null;

  const typeOf = (header: string) =>
    fields.find((f) => f.header === header)?.type ?? "text";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter, index) => (
        <Chip
          key={`${filter.field}-${filter.op}-${index}`}
          filter={filter}
          type={typeOf(filter.field)}
          onRemove={() => commit(filters.filter((_, i) => i !== index))}
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => commit([])}
      >
        Clear All
      </Button>
    </div>
  );
}

/**
 * The Filter control, and the panel behind it.
 *
 * A PANEL RATHER THAN A ROW OF CONTROLS. Every filterable column is listed at
 * once down the left, so choosing what to narrow by is reading rather than
 * opening a menu to find out, and the table below does not reflow while a
 * filter is being built.
 *
 * NOTHING IS APPLIED UNTIL Apply. Each filter used to be its own navigation:
 * narrowing by three columns meant three round trips, three server renders and
 * two intermediate lists nobody wanted to see. The panel edits a draft and
 * commits it once.
 */
export function FilterButton({
  fields,
  filters,
}: {
  fields: FilterField[];
  filters: Filter[];
}) {
  const commit = useCommitFilters();

  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);
  /**
   * The filters being edited, by column.
   *
   * ponytail: one filter per column. The URL grammar allows several — it is a
   * list, not a map — but every pane here produces at most one, and a range is
   * a single `between` rather than two half-open filters. A hand-written URL
   * carrying two filters on one column keeps both until this panel is applied.
   */
  const [draft, setDraft] = React.useState<Record<string, Filter>>({});

  if (fields.length === 0) return null;

  /** Opening seeds the draft from what is applied, so the panel edits rather
   *  than starts over. Closing without applying leaves the URL alone. */
  function onOpenChange(next: boolean) {
    if (next) {
      setDraft(Object.fromEntries(filters.map((f) => [f.field, f])));
      setActive(filters[0]?.field ?? fields[0].header);
    }
    setOpen(next);
  }

  function setFieldFilter(field: string, filter: Filter | null) {
    setDraft((current) => {
      const next = { ...current };
      // A cleared pane removes the filter rather than storing an empty one,
      // which would narrow the list to nothing on apply.
      if (filter) next[field] = filter;
      else delete next[field];
      return next;
    });
  }

  const activeField = fields.find((f) => f.header === active) ?? fields[0];
  const drafted = Object.keys(draft).length;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FilterIcon className="size-4" aria-hidden />
          Filter
          {filters.length > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] leading-none font-medium text-primary-foreground tabular-nums">
              {filters.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[34rem] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
      >
        <div className="flex min-h-80">
          {/* The rail: every filterable column, so the choice is visible
              rather than behind a menu. */}
          <ul className="w-48 shrink-0 space-y-1 border-r border-border bg-muted/40 p-3">
            {fields.map((field) => {
              const Icon = ICONS[field.type];
              const on = field.header === activeField.header;

              return (
                <li key={field.header}>
                  <button
                    type="button"
                    onClick={() => setActive(field.header)}
                    aria-current={on}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                      on
                        ? "bg-primary font-medium text-primary-foreground"
                        : "hover:bg-background",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{field.header}</span>
                    {/* A column already carrying a filter is marked, so the
                        rail says what is set without opening each pane. */}
                    {draft[field.header] ? (
                      <span
                        aria-label="has a filter"
                        className={cn(
                          "ml-auto size-1.5 shrink-0 rounded-full",
                          on ? "bg-primary-foreground" : "bg-primary",
                        )}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p className="border-b border-border pb-3 text-sm font-semibold">
                {activeField.header}
              </p>

              <div className="pt-4">
                <Pane
                  // Keyed by column so switching panes remounts them: the
                  // uncontrolled search box inside the enum pane belongs to
                  // the column it was typed for.
                  key={activeField.header}
                  field={activeField}
                  filter={draft[activeField.header]}
                  onChange={(filter) =>
                    setFieldFilter(activeField.header, filter)
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-border px-5 py-3.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setDraft({})}
                disabled={drafted === 0}
                aria-label="Reset all filters"
              >
                <RotateCcw aria-hidden />
              </Button>
              <Button
                type="button"
                size="sm"
                className="px-5"
                // Closed here rather than in `commit`, which the chips share
                // and which has no panel to close.
                onClick={() => {
                  setOpen(false);
                  commit(Object.values(draft));
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The controls one column filters with. Each type gets its own, not an
 *  operator menu: "at least 50" is the question, and picking `gte` first is a
 *  step between the reader and asking it. */
function Pane({
  field,
  filter,
  onChange,
}: {
  field: FilterField;
  filter: Filter | undefined;
  onChange: (filter: Filter | null) => void;
}) {
  if (field.type === "enum") {
    return (
      <EnumPane
        field={field.header}
        options={field.options ?? []}
        selected={filter?.values ?? []}
        onChange={onChange}
      />
    );
  }

  if (field.type === "date" || field.type === "number") {
    return (
      <RangePane
        field={field.header}
        type={field.type}
        filter={filter}
        onChange={onChange}
      />
    );
  }

  return <TextPane field={field.header} filter={filter} onChange={onChange} />;
}

/** Free text: what it contains, or whether it is blank at all. */
function TextPane({
  field,
  filter,
  onChange,
}: {
  field: string;
  filter: Filter | undefined;
  onChange: (filter: Filter | null) => void;
}) {
  const empty = filter?.op === "empty";

  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-xs text-muted-foreground">Contains</span>
        <Input
          autoFocus
          value={empty ? "" : (filter?.values[0] ?? "")}
          disabled={empty}
          placeholder={`Search ${field.toLowerCase()}`}
          onChange={(event) =>
            onChange(
              event.target.value
                ? { field, op: "contains", values: [event.target.value] }
                : null,
            )
          }
          className="h-9 text-sm"
        />
      </label>

      {/* Kept from the operator list this pane replaced: "has nothing in it"
          is a real question about a column and nothing else here asks it. */}
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={empty}
          onChange={(event) =>
            onChange(
              event.target.checked ? { field, op: "empty", values: [] } : null,
            )
          }
          className="size-3.5 accent-primary"
        />
        Only rows with no {field.toLowerCase()}
      </label>
    </div>
  );
}

/**
 * The values this column actually holds, as a checklist.
 *
 * Built from the loaded rows rather than a hardcoded list per column, so a new
 * status coming out of the backend appears here without a frontend change —
 * and a value nothing holds is never offered, which would filter to an empty
 * table.
 */
function EnumPane({
  field,
  options,
  selected,
  onChange,
}: {
  field: string;
  options: string[];
  selected: string[];
  onChange: (filter: Filter | null) => void;
}) {
  const [query, setQuery] = React.useState("");

  // Company and project columns filter as enums too, and those lists run to
  // whatever the page loaded. Offered only when the list is long enough to
  // need it, so a four-value status column stays one glance.
  const searchable = options.length > 8;
  const shown = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  function toggle(option: string) {
    const values = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option];
    onChange(values.length ? { field, op: "in", values } : null);
  }

  return (
    <div className="space-y-3">
      {searchable ? (
        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search values"
            aria-label={`Search ${field} values`}
            className="h-9 pl-9 text-sm"
          />
        </div>
      ) : null}

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing to filter by on this page.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No values match.</p>
      ) : (
        <ul className="-mx-2 max-h-56 space-y-1 overflow-y-auto px-2">
          {shown.map((option) => (
            <li key={option}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggle(option)}
                  className="size-3.5 shrink-0 accent-primary"
                />
                <span className="min-w-0 truncate">{option}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Both ends of a range, as two boxes.
 *
 * NO OPERATOR MENU. Which boxes are filled is what decides between "at least",
 * "at most" and "between" — see `rangeFilter`, which owns that mapping and is
 * tested. Native `date` and `number` inputs, so the browser's own picker,
 * keyboard handling and locale come for free.
 */
function RangePane({
  field,
  type,
  filter,
  onChange,
}: {
  field: string;
  type: "date" | "number";
  filter: Filter | undefined;
  onChange: (filter: Filter | null) => void;
}) {
  const [from, to] = rangeValues(filter);
  const labels = type === "date" ? ["From", "To"] : ["At least", "At most"];

  const set = (next: [string, string]) =>
    onChange(rangeFilter(field, next[0], next[1], type));

  return (
    <div className="space-y-4">
      {[from, to].map((value, index) => (
        <label key={index} className="block space-y-2">
          <span className="text-xs text-muted-foreground">{labels[index]}</span>
          <Input
            autoFocus={index === 0}
            type={type}
            value={value}
            onChange={(event) =>
              set(
                index === 0
                  ? [event.target.value, to]
                  : [from, event.target.value],
              )
            }
            className="h-9 text-sm"
          />
        </label>
      ))}
    </div>
  );
}

/** An applied filter, in words: `Status is any of Active, On Hold`. */
function Chip({
  filter,
  type,
  onRemove,
}: {
  filter: Filter;
  type: FilterType;
  onRemove: () => void;
}) {
  const values =
    filter.op === "between"
      ? filter.values.map(pretty).join(" – ")
      : filter.values.map(pretty).join(", ");

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 py-1 pr-1 pl-2.5 text-xs">
      <span>
        <span className="font-medium">{filter.field}</span>{" "}
        <span className="text-muted-foreground">
          {operatorLabel(type, filter.op)}
        </span>{" "}
        {values}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${filter.field} filter`}
        className="rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

/** `2026-09-30` reads as a date on screen, not as an ISO string. */
function pretty(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${Number(month)}/${Number(day)}/${year.slice(2)}`;
}
