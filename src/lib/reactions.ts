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

/** One reaction on a message, grouped and counted by the server. */
export interface MessageReaction {
  /** The character the chip draws. Resolved from the wire `reaction` name. */
  emoji: string;
  /** Everyone who reacted with it, the viewer included. */
  count: number;
  /** True when the viewer is one of them. Drives the chip's filled state. */
  mine: boolean;
}

/**
 * A reaction row as it arrives, in either of the two shapes a deployment sends.
 *
 * The API names reactions (`"love"`, `"like"`), so `reaction` is what a current
 * backend writes. `emoji` is kept because it is what this client sent before the
 * endpoint existed, and a row carrying one is not worth failing over — see
 * `toMessageReaction`.
 */
export interface BackendReaction {
  reaction?: string;
  emoji?: string;
  count?: number;
  mine?: boolean;
  /**
   * Set when the row belongs to one FILE on the message rather than to the
   * message itself — the same id `PUT .../reaction` takes as `attachmentId`.
   *
   * Read defensively rather than speculatively: a backend that returns
   * attachment reactions in the message's own flat list, instead of nesting
   * them under each file, would otherwise have them rendered as reactions on
   * the message. That is not a missing feature, it is chips appearing under the
   * wrong thing, so `toChatMessage` partitions on this key.
   */
  attachmentId?: number | null;
}

/**
 * The six the API stores, by wire name.
 *
 * PRIVATE, and read-only now: the reaction WRITES are gone (`PUT`/`DELETE
 * /chat/messages/:id/reaction` exist on no backend), so nothing picks from this
 * list any more. It stays because the message read still carries reactions and
 * they arrive as names, which `reactionEmoji` resolves.
 */
const REACTIONS: { emoji: string; name: string }[] = [
  { emoji: "👍", name: "like" },
  { emoji: "😂", name: "laugh" },
  { emoji: "😢", name: "sad" },
  { emoji: "😮", name: "wow" },
  { emoji: "❤️", name: "love" },
  { emoji: "🙏", name: "thanks" },
];

/**
 * The character for a wire name, falling back to the name itself.
 *
 * A backend that grows a seventh reaction before this list does would otherwise
 * render a blank chip. Showing the raw word ("shipped") is ugly and legible;
 * showing nothing is a chip that cannot be read or explained.
 */
export function reactionEmoji(name: string): string {
  return REACTIONS.find((r) => r.name === name)?.emoji ?? name;
}

/**
 * One server row, whichever shape it arrived in.
 *
 * `count` defaults to 1 rather than 0: a row that exists describes at least one
 * reactor, and a chip reading "0" is the thing every branch here avoids.
 */
export function toMessageReaction(row: BackendReaction): MessageReaction {
  return {
    emoji: row.emoji ?? (row.reaction ? reactionEmoji(row.reaction) : ""),
    count: row.count ?? 1,
    mine: row.mine ?? false,
  };
}

/**
 * The composer's picker: 96 emoji in eight buckets of twelve.
 *
 * ORDER IS THE CATEGORY, and it has to be at this size. Forty-eight in no
 * particular order could be scanned; ninety-six cannot, so the list below runs
 * in blocks — acknowledge, positive, thinking, concern, celebrate, documents,
 * business, signals — and finding one means knowing roughly how far down it is
 * rather than reading every cell. That is the whole of the organisation, and it
 * is why there are no tabs: tabs hide seven eighths of the set behind a click,
 * which for a set this small costs more than it saves.
 *
 * The GRID's column count is the view's business, not this file's — at six
 * across each block is two rows, at twelve it is one. Keep the blocks twelve
 * long so both divide evenly and no bucket starts mid-row.
 *
 * STILL NO SEARCH, and 96 is the ceiling rather than a step towards more.
 * Search needs a keyword index and recents need per-user storage; both exist to
 * make a set of two THOUSAND usable, which is a different feature. Anything not
 * here is two keystrokes away in the operating system's own picker
 * (Ctrl+Cmd+Space on a Mac, Win+. on Windows, the keyboard itself on a phone),
 * which every one of these users already has and which this grid is not trying
 * to replace.
 *
 * WHAT IS DELIBERATELY ABSENT: 😘 😍 😡 😱 🙃 😴 and their neighbours. Threads
 * here run between an accounting manager and a paying client, and a picker is a
 * menu of things the product is suggesting an employee send one — a kiss, an
 * eye-roll or visible panic from the person doing your books is a support
 * ticket, not a message. Ordinary sympathy and frustration are in row four.
 *
 * Nothing here is newer than Unicode 11 (2018), so every glyph has a real face
 * on the older Windows installs some of these clients are on. A 2021 emoji
 * renders as a tofu box there, which reads as a broken app rather than a
 * missing font.
 */
export const COMPOSER_EMOJI: string[] = [
  // Acknowledge and approve — by far the most-used row in a work thread.
  "👍", "👌", "🙏", "✅", "👏", "🙌", "💪", "🤝", "🙋", "👀", "✍️", "🤞",
  // Positive.
  "😀", "😃", "😄", "😁", "😆", "😂", "🙂", "😊", "😉", "😌", "😎", "🤗",
  // Thinking, neutral, unsure.
  "🤔", "😐", "😑", "😬", "😅", "🤷", "💭", "😶", "😯", "🤨", "🧐", "😕",
  // Concern, apology, bad news.
  "😢", "😥", "😞", "😟", "😰", "😓", "😮", "😲", "🤦", "😵", "😔", "👎",
  // Celebrate.
  "🎉", "🎊", "🥳", "🔥", "⭐", "🌟", "💯", "✨", "❤️", "🧡", "💚", "💙",
  // Documents — what most of these threads are actually about.
  "📌", "📎", "📅", "🗓️", "📁", "📄", "📝", "🖊️", "📊", "📈", "📉", "🧾",
  // Money and the business around it.
  "💰", "💵", "💳", "🏦", "🧮", "💼", "🏢", "📦", "🚀", "🎯", "⏰", "⌛",
  // Signals and status.
  "❌", "⚠️", "❗", "❓", "🔴", "🟢", "🟡", "🔵", "🚩", "🔒", "🔔", "➡️",
];
