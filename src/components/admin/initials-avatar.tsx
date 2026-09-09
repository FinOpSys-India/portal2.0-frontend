import { cn } from "@/lib/utils";

/**
 * Two initials from a person's name.
 *
 * First letter of the first word plus first letter of the last word, so
 * "Priya Nair" gives PN and a middle name does not steal the second slot.
 * Single-word names fall back to their first two letters rather than showing
 * one lonely character.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  const first = words[0][0];
  const last = words[words.length - 1][0];
  return `${first}${last}`.toUpperCase();
}

/**
 * Avatar tints.
 *
 * Hues sit either side of the brand's 300 — violet, indigo, blue, teal on one
 * side, plum and rose on the other — so every circle is a relative of the
 * purple rather than a clash. Chroma is held low and lightness constant, so
 * they read as one family instead of a bag of highlighters.
 *
 * Each pair is a pale fill with a same-hue text at L=0.45, which clears 4.5:1
 * on its own background.
 */
const TINTS = [
  { bg: "oklch(0.95 0.035 300)", fg: "oklch(0.45 0.15 300)" }, // violet
  { bg: "oklch(0.95 0.035 275)", fg: "oklch(0.45 0.15 275)" }, // indigo
  { bg: "oklch(0.95 0.035 245)", fg: "oklch(0.45 0.13 245)" }, // blue
  { bg: "oklch(0.95 0.035 200)", fg: "oklch(0.45 0.11 200)" }, // teal
  { bg: "oklch(0.95 0.035 330)", fg: "oklch(0.45 0.15 330)" }, // plum
  { bg: "oklch(0.95 0.035 15)", fg: "oklch(0.47 0.15 15)" }, // rose
] as const;

/**
 * Picks a tint from the name. Deterministic, so a person keeps the same
 * colour across every table and page — a colour that changed on reload would
 * be worse than no colour at all.
 */
export function tintFor(name: string): (typeof TINTS)[number] {
  // Internal whitespace is collapsed, not just trimmed: records really do
  // carry names like "Test  Customer", and a double space must not hand the
  // same person a second colour.
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");

  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

/**
 * Someone's picture, falling back to their initials.
 *
 * THE PICTURE IS THE POINT OF THE `src`. Uploading an avatar used to change
 * exactly one circle on the screen it was uploaded from, because this
 * component took a name and nothing else — every other avatar in the portal is
 * drawn here, so none of them could show one however many the API returned.
 *
 * A plain `<img>`: the URL is a public bucket on a host `next.config` does not
 * list, and next/image would refuse it at runtime rather than at build time.
 * No error fallback, deliberately — the URL is derived from the stored key, so
 * clearing the picture clears the key and there is no stale URL to break on.
 *
 * `aria-hidden` either way. Every caller renders the person's name beside it;
 * an avatar that also announced the name would say it twice.
 */
export function InitialsAvatar({
  name,
  src,
  className,
}: {
  name: string;
  /** Their uploaded picture, when they have one. */
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn(
          "size-8 shrink-0 rounded-full object-cover",
          className,
        )}
      />
    );
  }

  const tint = tintFor(name);

  return (
    <span
      aria-hidden
      style={{ backgroundColor: tint.bg, color: tint.fg }}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold select-none",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Avatar followed by the name. The avatar is decorative; the name carries it. */
export function PersonCell({
  name,
  avatarUrl,
}: {
  name: string;
  /** Passed wherever the row carries one — see `personAvatarUrl`. */
  avatarUrl?: string | null;
}) {
  return (
    <span className="flex items-center gap-2.5">
      {/* White ring keeps the circle its own shape once the row tints on
          hover, instead of the tint running up to its edge. */}
      <InitialsAvatar name={name} src={avatarUrl} className="ring-2 ring-card" />
      <span className="font-medium">{name}</span>
    </span>
  );
}

/**
 * Overlapping avatars with a +N overflow chip, for a set of people shown
 * inside one cell.
 *
 * The circles are `aria-hidden`, so the names are carried by a visually
 * hidden list — otherwise a screen reader would announce a team of five as
 * nothing at all. `title` gives mouse users the same list on hover.
 */
export function AvatarStack({
  names,
  max = 4,
}: {
  names: string[];
  /** How many circles before the rest collapse into +N. */
  max?: number;
}) {
  if (names.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <span className="flex items-center" title={names.join(", ")}>
      {shown.map((name) => (
        <InitialsAvatar
          key={name}
          name={name}
          // The ring is the gap: it cuts each circle out of the one behind it,
          // so they read as separate people rather than one blob.
          className="-ml-2 ring-2 ring-card first:ml-0"
        />
      ))}

      {overflow > 0 ? (
        <span
          aria-hidden
          className="-ml-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card select-none"
        >
          +{overflow}
        </span>
      ) : null}

      <span className="sr-only">{names.join(", ")}</span>
    </span>
  );
}
