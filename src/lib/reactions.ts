/**
 * Emoji, in the two places a chat uses them.
 *
 * NO LIBRARY AND NO ASSETS. Emoji are Unicode text: the browser draws them with
 * the font the operating system already ships, so a picker is a list of string
 * literals and a grid of buttons. Vendoring glyph images (noto-emoji and the
 * like) buys identical rendering across platforms and costs megabytes for it,
 * which is not a trade a chat box is worth.
 *
 * The two sets below are deliberately different sizes, because they answer
 * different questions. COMPOSER_EMOJI is "what might I want to type", so it is
 * broad and unlabelled — you recognise the one you want by looking. REACTIONS
 * is "what can I say about this message without replying", and a fixed six is
 * the point: a wide reaction set fragments the counts and turns a glance into
 * reading.
 */

/** One emoji on a message, grouped and counted by the server. */
export interface MessageReaction {
  emoji: string;
  /** Everyone who reacted with it, the viewer included. */
  count: number;
  /** True when the viewer is one of them. Drives the chip's filled state. */
  mine: boolean;
}

/**
 * The six offered on a bubble.
 *
 * The emoji is what gets stored and sent — not a key like "like". The column
 * stays readable in a database client, and a seventh reaction needs no
 * migration. `label` is the button's accessible name: a screen reader reading
 * the raw character announces the CLDR name ("face with tears of joy"), which
 * says what the picture is rather than what pressing it means.
 */
export const REACTIONS: { emoji: string; label: string }[] = [
  { emoji: "👍", label: "Like" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😮", label: "Wow" },
  { emoji: "❤️", label: "Love" },
  { emoji: "🙏", label: "Thanks" },
];

/**
 * The composer's picker: 48 emoji, six rows of eight, no categories.
 *
 * FLAT AND UNSEARCHABLE ON PURPOSE. Search needs a keyword index, categories
 * need tabs and scroll state, and both exist to make a set of two thousand
 * usable. Forty-eight fits in one glance, and anything not here is two
 * keystrokes away in the operating system's own picker (Ctrl+Cmd+Space on a
 * Mac, Win+. on Windows, the keyboard itself on a phone) — which every one of
 * these users already has and which this grid is not trying to replace.
 */
export const COMPOSER_EMOJI: string[] = [
  "😀", "😄", "😁", "😆", "😅", "😂", "🙂", "😉",
  "😊", "😍", "😘", "😎", "🤔", "😐", "😴", "🙃",
  "😬", "😢", "😭", "😮", "😲", "😳", "😱", "😡",
  "🤯", "🥳", "🤗", "😷", "🤝", "💪", "👋", "🙏",
  "👍", "👎", "👏", "🙌", "✅", "❌", "⚠️", "❤️",
  "🔥", "⭐", "🎉", "💯", "📌", "📎", "📅", "💼",
];

/**
 * The viewer's reaction, added or removed, as the server will report it.
 *
 * Optimistic: the chip has to move on the click, not on the round trip, because
 * a reaction that waits for a network answer reads as a dead button and gets
 * pressed again. The caller keeps the old array to put back if the request
 * fails, so nothing here mutates its input.
 *
 * REMOVING THE LAST ONE DELETES THE ENTRY rather than leaving a count of zero,
 * which is the only case here that is not arithmetic — a chip reading "0" is
 * the bug this function exists to not have.
 */
export function toggleLocal(
  reactions: MessageReaction[],
  emoji: string,
): MessageReaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);

  if (!existing) {
    // Appended, not sorted in: the server returns them in the order they were
    // first used, and re-ordering on every click would move the chips out from
    // under the cursor.
    return [...reactions, { emoji, count: 1, mine: true }];
  }

  if (!existing.mine) {
    return reactions.map((r) =>
      r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r,
    );
  }

  if (existing.count <= 1) return reactions.filter((r) => r.emoji !== emoji);

  return reactions.map((r) =>
    r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r,
  );
}
