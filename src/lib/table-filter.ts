/**
 * The filter language behind `?f=` on every list.
 *
 * Pure on purpose: the table applies it on the server, the filter bar builds it
 * in the browser, and this module is the one place that agrees on what a filter
 * MEANS. It holds no React so both sides can import it without dragging the
 * other's runtime along.
 *
 * ponytail: filters run over the rows a page was handed. The API takes
 * `search`, `status`, `role` and `specialistUserId` but nothing else, so the
 * general engine lives here until those params exist for every field. When they
 * do, the parsed filters below are what gets forwarded instead.
 */

/**
 * How a column's values compare. Decides which operators the bar offers.
 *
 * `list` is `enum` for a cell that holds SEVERAL values — the companies a
 * customer belongs to, the services a company bought. It matches on any one of
 * them, where `enum` compares the cell as a whole.
 */
export type FilterType = "text" | "enum" | "date" | "number" | "list";

export type Operator =
  | "contains"
  | "is"
  | "isnot"
  | "empty"
  | "in"
  | "all"
  | "notin"
  | "gte"
  | "lte"
  | "before"
  | "after"
  | "between";

export type Filter = {
  /** Column header, the same key `?sort=` uses. */
  field: string;
  op: Operator;
  /** One value for most operators, two for `between`, many for `in`. */
  values: string[];
};

type OperatorSpec = {
  op: Operator;
  label: string;
  /** How many value inputs the bar renders for it. */
  inputs: 0 | 1 | 2;
};

/**
 * Operators per column type, first one being the default.
 *
 * Deliberately short. Every operator here is one someone asks for out loud
 * ("deadline before the 30th", "status is any of these two"); a full comparison
 * grid would be more code to read and no more answers.
 */
export const OPERATORS: Record<FilterType, OperatorSpec[]> = {
  text: [
    { op: "contains", label: "contains", inputs: 1 },
    { op: "is", label: "is", inputs: 1 },
    { op: "isnot", label: "is not", inputs: 1 },
    { op: "empty", label: "is empty", inputs: 0 },
  ],
  enum: [
    { op: "in", label: "is any of", inputs: 1 },
    { op: "notin", label: "is none of", inputs: 1 },
  ],
  list: [
    { op: "in", label: "is any of", inputs: 1 },
    // Only a multi-value cell can hold all of them at once, which is why this
    // is here and not on `enum`: a customer is on several companies, a project
    // has one status.
    { op: "all", label: "has all of", inputs: 1 },
    { op: "notin", label: "is none of", inputs: 1 },
  ],
  date: [
    { op: "before", label: "before", inputs: 1 },
    { op: "after", label: "on or after", inputs: 1 },
    { op: "between", label: "between", inputs: 2 },
    // Appended rather than inserted: `defaultOperator` reads the first entry.
    // It is here so a From/To pane can close its upper end INCLUSIVELY —
    // `lte` on a date means "before the end of that day", where `before` stops
    // at its midnight — and so the chip has a label to print for it.
    { op: "lte", label: "on or before", inputs: 1 },
  ],
  number: [
    { op: "gte", label: "at least", inputs: 1 },
    { op: "lte", label: "at most", inputs: 1 },
    { op: "between", label: "between", inputs: 2 },
  ],
};

export function operatorLabel(type: FilterType, op: Operator): string {
  return OPERATORS[type].find((o) => o.op === op)?.label ?? op;
}

/** The operator a freshly added filter starts on. */
export function defaultOperator(type: FilterType): Operator {
  return OPERATORS[type][0].op;
}

const OPERATOR_SET = new Set<string>(
  Object.values(OPERATORS).flatMap((specs) => specs.map((s) => s.op)),
);

/**
 * `Field:op:value|value` — one `?f=` per filter, several `f` params for several
 * filters, ANDed.
 *
 * Field and values are percent-encoded INSIDE the param because both are free
 * text: a file called `a|b.pdf` or a column named `Current Plan` would
 * otherwise cut the filter in half at the wrong character.
 */
export function serializeFilter({ field, op, values }: Filter): string {
  return [
    encodeURIComponent(field),
    op,
    values.map(encodeURIComponent).join("|"),
  ].join(":");
}

/**
 * The active filters, straight off `searchParams.f`.
 *
 * Junk is dropped rather than thrown: `?f=` is whatever someone typed, pasted
 * or kept in a bookmark after a column was renamed, and a bad filter should
 * leave the list readable — the same rule `?sort=` follows.
 */
export function parseFilters(raw: string | string[] | undefined): Filter[] {
  const all = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

  return all.flatMap((entry) => {
    // Only the first two colons separate: a value may contain one.
    const first = entry.indexOf(":");
    const second = entry.indexOf(":", first + 1);
    if (first < 1 || second < 0) return [];

    const field = safeDecode(entry.slice(0, first));
    const op = entry.slice(first + 1, second);
    if (!field || !OPERATOR_SET.has(op)) return [];

    const rest = entry.slice(second + 1);
    const values = rest === "" ? [] : rest.split("|").map(safeDecode);

    // Every operator but `is empty` needs something to compare against.
    if (op !== "empty" && values.every((v) => v === "")) return [];

    return [{ field, op: op as Operator, values }];
  });
}

/** `decodeURIComponent` throws on a stray `%`, which a hand-edited URL has. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * A From/To pair as one filter, or null when neither end is filled.
 *
 * The pane a reader sees is two boxes, not an operator menu — "at least 50",
 * "up to the 30th", or both — so the operator is DERIVED from which of them
 * they filled. That mapping is the only branching in the filter bar, which is
 * why it lives here as a function rather than inline in a component.
 *
 * Both ends are inclusive, in both directions. `lte` closes the upper end on a
 * date as well as a number, because `before` stops at the named day's midnight
 * and a reader who typed the 30th means the whole of the 30th.
 */
export function rangeFilter(
  field: string,
  from: string,
  to: string,
  type: "date" | "number",
): Filter | null {
  const low = from.trim();
  const high = to.trim();

  if (low && high) return { field, op: "between", values: [low, high] };
  // `after` and `gte` compare identically; each is the one its own column type
  // has a label for.
  if (low) return { field, op: type === "date" ? "after" : "gte", values: [low] };
  if (high) return { field, op: "lte", values: [high] };
  return null;
}

/**
 * The two boxes again, from the filter `rangeFilter` built.
 *
 * Reopening the pane has to show what is already applied, and a filter carries
 * its ends positionally — one value means either end depending on the
 * operator, which is exactly what this puts back.
 */
export function rangeValues(filter: Filter | undefined): [string, string] {
  if (!filter) return ["", ""];
  const [first = "", second = ""] = filter.values;

  if (filter.op === "between") return [first, second];
  if (filter.op === "lte" || filter.op === "before") return ["", first];
  return [first, ""];
}

/**
 * `2026-09-30` as a local Date, or undefined when there is nothing to read.
 *
 * The calendar in the filter panel speaks `Date`, the URL speaks this format,
 * and both conversions belong beside the comparison that uses them — a
 * `new Date("2026-09-30")` anywhere else would land on UTC midnight and show
 * the previous day west of Greenwich.
 */
export function fromDateValue(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

/** A Date back to `2026-09-30`, in the reader's own timezone. */
export function toDateValue(date: Date | undefined): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Checklist options under their initial letter, or one unlabelled group.
 *
 * Options arrive sorted, so this only cuts them where the initial changes.
 * Anything not starting with a letter — a company written "3M", a quoted name —
 * collects under `#`, which is where the sort puts it anyway.
 */
export function byInitial(
  options: string[],
  grouped: boolean,
): [string, string[]][] {
  if (!grouped) return [["", options]];

  const groups = new Map<string, string[]>();

  for (const option of options) {
    // NFD first, so an accented initial files under its own letter rather than
    // under `#` — Ålesund Air is an A to everyone reading the list.
    const initial = option.trim().charAt(0).toUpperCase().normalize("NFD")[0];
    const key = /[A-Z]/.test(initial ?? "") ? initial : "#";
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }

  return [...groups];
}

/**
 * Does one row's value for this column pass this filter?
 *
 * `value` is whatever the column sorts on: text for names, a timestamp for
 * dates, a number for counts. That is why a date column has to declare
 * `filter: "date"` — as text, its timestamp would compare like a phone number.
 *
 * An ARRAY is a cell holding several values, and passes when any one of them
 * does: a customer on three companies is matched by a filter naming any of the
 * three. A single value is the one-item case of the same rule, so both go down
 * the same branches rather than through a parallel set.
 */
export function matchesFilter(
  value: string | number | string[],
  filter: Filter,
  type: FilterType,
): boolean {
  const [first = "", second = ""] = filter.values;
  const items = Array.isArray(value) ? value : [value];
  const some = (test: (item: string | number) => boolean) => items.some(test);
  const named = (item: string | number) =>
    filter.values.some((v) => fold(item) === fold(v));

  switch (filter.op) {
    // `every`, so an empty array — a customer on no company at all — reads as
    // empty rather than as a row with nothing to say.
    case "empty":
      return items.every((item) => String(item).trim() === "");
    case "contains":
      return some((item) => fold(item).includes(fold(first)));
    case "is":
      return some((item) => fold(item) === fold(first));
    case "isnot":
      return !some((item) => fold(item) === fold(first));
    case "in":
      return some(named);
    case "all":
      return filter.values.every((v) =>
        items.some((item) => fold(item) === fold(v)),
      );
    case "notin":
      return !some(named);
    default:
      return matchesRange(Number(value), filter, type, first, second);
  }
}

function matchesRange(
  value: number,
  filter: Filter,
  type: FilterType,
  first: string,
  second: string,
): boolean {
  if (Number.isNaN(value)) return false;

  const bound = (raw: string) =>
    type === "date" ? startOfDay(raw) : Number(raw);
  // A date names a whole day, so `between 1st and 3rd` has to include
  // everything stamped on the 3rd, not just its midnight.
  const end = (raw: string) =>
    type === "date" ? startOfDay(raw) + DAY : Number(raw);

  switch (filter.op) {
    case "before":
      return value < bound(first);
    case "after":
      return value >= bound(first);
    case "gte":
      return value >= bound(first);
    case "lte":
      return type === "date" ? value < end(first) : value <= Number(first);
    case "between": {
      const low = bound(first);
      const high = end(second);
      return value >= low && (type === "date" ? value < high : value <= high);
    }
    default:
      return true;
  }
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Midnight LOCAL, not UTC.
 *
 * `<input type="date">` hands over `2026-09-30`, which `Date.parse` reads as
 * UTC midnight — and the deadlines these compare against are local midnight.
 * West of Greenwich that difference lands a deadline on the wrong side of its
 * own date.
 */
function startOfDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return Number(value);
  return new Date(year, month - 1, day).getTime();
}

function fold(value: string | number): string {
  return String(value).trim().toLowerCase();
}
