/**
 * Split chat text into plain runs and http(s) links.
 *
 * Message bodies are user text and render as text; this only decides which
 * runs become an `<a>`. Each candidate is re-parsed with `URL`, so nothing but
 * an http or https address is ever handed to an `href`. Punctuation that ends
 * a sentence ("…see https://a.com.") stays outside the link.
 */
export function splitLinks(
  text: string,
): ({ text: string } | { text: string; href: string })[] {
  const parts: ({ text: string } | { text: string; href: string })[] = [];
  let rest = 0;

  for (const match of text.matchAll(/https?:\/\/\S+/g)) {
    const raw = match[0].replace(/[.,!?;:)\]'"]+$/, "");
    if (!isWebUrl(raw)) continue;
    const at = match.index;
    if (at > rest) parts.push({ text: text.slice(rest, at) });
    parts.push({ text: raw, href: raw });
    rest = at + raw.length;
  }

  if (rest < text.length) parts.push({ text: text.slice(rest) });
  return parts;
}

function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
