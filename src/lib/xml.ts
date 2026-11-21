import type { Segment } from "./types";

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode HTML/XML entities once. */
export function decodeEntitiesOnce(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

/**
 * YouTube's timedtext XML is often double-encoded (`&amp;#39;`), so decode
 * up to three times until it stops changing.
 */
export function decodeEntities(s: string): string {
  let out = s;
  for (let i = 0; i < 3; i++) {
    const next = decodeEntitiesOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function cleanText(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m?.[1];
}

/**
 * Parse YouTube timedtext XML. Handles format 1 (`<text start dur>`, seconds)
 * and format 3 / srv3 (`<p t d>` in milliseconds, words in `<s>`).
 * Empty cues are dropped.
 */
export function parseTimedText(xml: string): Segment[] {
  const out: Segment[] = [];

  const f1 = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = f1.exec(xml))) {
    const text = cleanText(m[2]);
    if (!text) continue;
    out.push({
      start: Number(attr(m[1], "start") ?? 0),
      duration: Number(attr(m[1], "dur") ?? 0),
      text,
    });
  }
  if (out.length) return out;

  const f3 = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  while ((m = f3.exec(xml))) {
    const text = cleanText(m[2]);
    if (!text) continue;
    out.push({
      start: Number(attr(m[1], "t") ?? 0) / 1000,
      duration: Number(attr(m[1], "d") ?? 0) / 1000,
      text,
    });
  }
  return out;
}
