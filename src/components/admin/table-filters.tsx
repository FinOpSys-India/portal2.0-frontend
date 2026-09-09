"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Filter as FilterIcon, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OPERATORS,
  defaultOperator,
  operatorLabel,
  serializeFilter,
  type Filter,
  type FilterType,
  type Operator,
} from "@/lib/table-filter";
import { cn } from "@/lib/utils";

/** One filterable column, as the table describes it to the bar. */
export type FilterField = {
  header: string;
  type: FilterType;
  /** The distinct values in the loaded rows. Enum columns only. */
  options?: string[];
};

/**
 * The filter bar: what is filtering now, and a way to add more.
 *
 * Client only for the URL. The filtering itself happens on the server, in the
 * table — this writes `?f=` and nothing else, which keeps one definition of
 * what a filter means and lets a filtered list be linked, bookmarked and
 * reloaded.
 *
 * ponytail: a chip is add-or-remove, not editable in place. Changing a filter
 * is remove-then-add, two clicks, no second state machine. Editing is worth
 * building when someone tunes the same date range repeatedly.
 */
export function TableFilters({
  fields,
  filters,
}: {
  fields: FilterField[];
  filters: Filter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The filter being built, before it is committed to the URL. Null when the
  // bar is just showing what is already applied.
  const [draft, setDraft] = React.useState<Filter | null>(null);

  if (fields.length === 0) return null;

  const typeOf = (header: string) =>
    fields.find((f) => f.header === header)?.type ?? "text";

  function commit(next: Filter[]) {
    const params = new URLSearchParams(searchParams);
    params.delete("f");
    for (const filter of next) params.append("f", serializeFilter(filter));
    // A narrower list has fewer pages, so page 4 of the old list is usually
    // past the end of the new one.
    params.delete("page");

    setDraft(null);
    const query = params.toString();
    // The table redraws in place; scrolling to the top would throw away the
    // reader's position in a long list.
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

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

      {draft ? (
        <DraftFilter
          draft={draft}
          field={fields.find((f) => f.header === draft.field)!}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onApply={() => commit([...filters, draft])}
        />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FilterIcon className="size-3.5" aria-hidden />
              Add Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Filter by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {fields.map((field) => (
              <DropdownMenuItem
                key={field.header}
                onSelect={() =>
                  setDraft({
                    field: field.header,
                    op: defaultOperator(field.type),
                    values: [],
                  })
                }
              >
                {field.header}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {filters.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => commit([])}
        >
          Clear All
        </Button>
      ) : null}
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
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 py-1 pl-2.5 pr-1 text-xs">
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

/** The filter being built: operator, then whatever values it needs. */
function DraftFilter({
  draft,
  field,
  onChange,
  onCancel,
  onApply,
}: {
  draft: Filter;
  field: FilterField;
  onChange: (filter: Filter) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const specs = OPERATORS[field.type];
  const inputs = specs.find((s) => s.op === draft.op)?.inputs ?? 1;
  // Nothing to apply until there is something to compare against — except
  // `is empty`, which is the whole filter on its own.
  const ready = inputs === 0 || draft.values.some((v) => v !== "");

  const setValue = (index: number, value: string) => {
    const values = [...draft.values];
    values[index] = value;
    onChange({ ...draft, values });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onApply();
      }}
      // Escape anywhere in the row abandons the draft, which is what a reader
      // who opened the wrong column expects.
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/30 bg-card p-1.5"
    >
      <span className="pl-1 text-xs font-medium">{draft.field}</span>

      <Select
        value={draft.op}
        onValueChange={(op) =>
          onChange({ ...draft, op: op as Operator, values: [] })
        }
      >
        <SelectTrigger size="sm" className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {specs.map((spec) => (
            <SelectItem key={spec.op} value={spec.op} className="text-xs">
              {spec.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {field.type === "enum" && inputs > 0 ? (
        <EnumValues
          options={field.options ?? []}
          selected={draft.values}
          onToggle={(option) =>
            onChange({
              ...draft,
              values: draft.values.includes(option)
                ? draft.values.filter((v) => v !== option)
                : [...draft.values, option],
            })
          }
        />
      ) : (
        Array.from({ length: inputs }, (_, index) => (
          <Input
            key={index}
            autoFocus={index === 0}
            // Native date and number inputs: the browser's own picker, keyboard
            // handling and locale, for none of our code.
            type={
              field.type === "date"
                ? "date"
                : field.type === "number"
                  ? "number"
                  : "text"
            }
            value={draft.values[index] ?? ""}
            onChange={(event) => setValue(index, event.target.value)}
            placeholder={index === 1 ? "to" : "value"}
            className="h-8 w-36 text-xs"
          />
        ))
      )}

      <Button type="submit" size="sm" className="h-8 px-2" disabled={!ready}>
        <Check className="size-3.5" aria-hidden />
        <span className="sr-only">Apply filter</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={onCancel}
      >
        <X className="size-3.5" aria-hidden />
        <span className="sr-only">Cancel filter</span>
      </Button>
    </form>
  );
}

/**
 * The values an enum column actually holds, as a checklist.
 *
 * Built from the loaded rows rather than a hardcoded list per column, so a new
 * status coming out of the backend appears here without a frontend change.
 */
function EnumValues({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-normal">
          {selected.length > 0 ? selected.join(", ") : "Select values"}
          <Plus className="size-3 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {options.length === 0 ? (
          <DropdownMenuItem disabled>No values</DropdownMenuItem>
        ) : (
          options.map((option) => (
            <DropdownMenuItem
              key={option}
              // The menu stays open: picking two of five statuses should not
              // mean opening it twice.
              onSelect={(event) => {
                event.preventDefault();
                onToggle(option);
              }}
            >
              <Check
                className={cn(
                  "size-3.5",
                  !selected.includes(option) && "opacity-0",
                )}
                aria-hidden
              />
              {option}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** `2026-09-30` reads as a date on screen, not as an ISO string. */
function pretty(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${Number(month)}/${Number(day)}/${year.slice(2)}`;
}
