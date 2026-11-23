/**
 * Links in chat text. Run: npx tsx src/lib/links.test.ts
 *
 * A message body is user text. Only http(s) addresses become links, and the
 * punctuation that ends a sentence stays outside the link.
 */
import assert from "node:assert/strict";

import { splitLinks } from "./links";

assert.deepEqual(splitLinks("see https://a.com/x, thanks"), [
  { text: "see " },
  { text: "https://a.com/x", href: "https://a.com/x" },
  { text: ", thanks" },
]);

assert.deepEqual(splitLinks("Join: https://teams.microsoft.com/l/meetup-join/19%3a.")
  .map((p) => ("href" in p ? p.href : null)), [
  null,
  "https://teams.microsoft.com/l/meetup-join/19%3a",
  null,
]);

assert.deepEqual(splitLinks("(see http://a.com)"), [
  { text: "(see " },
  { text: "http://a.com", href: "http://a.com" },
  { text: ")" },
]);

assert.deepEqual(
  splitLinks("javascript:alert(1)"),
  [{ text: "javascript:alert(1)" }],
  "anything but http(s) stays text",
);

assert.deepEqual(splitLinks("no links here"), [{ text: "no links here" }]);
assert.deepEqual(splitLinks(""), []);

assert.deepEqual(splitLinks("https://a.com https://b.com"), [
  { text: "https://a.com", href: "https://a.com" },
  { text: " " },
  { text: "https://b.com", href: "https://b.com" },
]);

console.log("links: ok");
