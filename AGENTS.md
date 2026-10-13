<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI copy

## Capitalization

One rule, so the same thing is not named three ways (CU-21):

**Title Case** for anything NAMED — buttons, links that act, nav items, page and
section headings, table column headers, field and stat labels, badges, browser
titles. Minor words stay lowercase unless first or last: *a, an, and, as, at,
by, for, in, of, on, or, per, the, to, up, via, with*. So "Add Company",
"Monthly Total", "Reset All", "Rows per Page".

**Sentence case** for anything READ as prose — descriptions and help text,
placeholders, empty states, alerts, toasts, validation messages, `aria-label`
and `sr-only` names, and a heading that is a full clause rather than a noun
phrase ("Your accounting manager is on the way"). A link inside a sentence takes
the sentence's case ("Complete payment to start using it").

Table CELL content is data, not chrome: shown as the backend names it, tidied
only where the backend's wording is wrong (see `planLabel` in `lib/billing`).

`/login-v1` and `/signup-v1` are exempt — they reproduce Portal 1.0 as-built,
wording included.
