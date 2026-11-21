import type { Segment, TranscriptResult } from "./types";

export const FORMATS = ["txt", "timestamped", "srt", "vtt", "json"] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_META: Record<Format, { ext: string; mime: string; label: string }> = {
  txt: { ext: "txt", mime: "text/plain; charset=utf-8", label: ".txt" },
  timestamped: { ext: "txt", mime: "text/plain; charset=utf-8", label: ".txt (timestamps)" },
  srt: { ext: "srt", mime: "application/x-subrip; charset=utf-8", label: ".srt" },
  vtt: { ext: "vtt", mime: "text/vtt; charset=utf-8", label: ".vtt" },
  json: { ext: "json", mime: "application/json; charset=utf-8", label: ".json" },
};

export function isFormat(f: string): f is Format {
  return (FORMATS as readonly string[]).includes(f);
}

/** 75.5 -> "1:15", 3725 -> "1:02:05" (what people read). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** 75.5 -> "00:01:15,500" (SRT) or "00:01:15.500" (VTT). */
export function formatCueTime(seconds: number, sep: "," | "."): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms, 3)}`;
}

/** Normalise whitespace (sound tags like [Music] are kept). */
function norm(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

export interface Paragraph {
  start: number;
  text: string;
}

/**
 * Group caption cues into readable paragraphs.
 * A new paragraph starts after a sentence ends once the paragraph is at least
 * `minChars` long, when it passes `maxChars`, or after a silence of `gapSeconds`.
 */
export function toParagraphs(
  segments: Segment[],
  opts: { minChars?: number; maxChars?: number; gapSeconds?: number } = {},
): Paragraph[] {
  const { minChars = 350, maxChars = 900, gapSeconds = 4 } = opts;
  const paras: Paragraph[] = [];
  let cur: Paragraph | null = null;
  let prevEnd = 0;

  for (const seg of segments) {
    const text = norm(seg.text);
    if (!text) continue;
    const gap = seg.start - prevEnd;
    if (cur && (gap >= gapSeconds || cur.text.length >= maxChars)) {
      paras.push(cur);
      cur = null;
    }
    if (!cur) cur = { start: seg.start, text };
    else cur.text += " " + text;
    prevEnd = seg.start + seg.duration;
    if (cur.text.length >= minChars && /[.!?]["')\]]?$/.test(text)) {
      paras.push(cur);
      cur = null;
    }
  }
  if (cur) paras.push(cur);
  return paras;
}

/** Plain text: paragraphs separated by blank lines. */
export function toPlainText(segments: Segment[]): string {
  return toParagraphs(segments)
    .map((p) => p.text)
    .join("\n\n");
}

/** Paragraphs prefixed with [m:ss]. */
export function toTimestampedText(segments: Segment[]): string {
  return toParagraphs(segments)
    .map((p) => `[${formatClock(p.start)}] ${p.text}`)
    .join("\n\n");
}

/**
 * End time for cue i. Auto-generated captions overlap (each cue lasts until
 * the one after next), which looks wrong in players, so clamp to the next start.
 */
function cueEnd(segments: Segment[], i: number): number {
  const s = segments[i];
  let end = s.start + (s.duration > 0 ? s.duration : 2);
  const next = segments[i + 1];
  if (next && next.start > s.start && end > next.start) end = next.start;
  return end;
}

export function toSrt(segments: Segment[]): string {
  return (
    segments
      .map(
        (s, i) =>
          `${i + 1}\n${formatCueTime(s.start, ",")} --> ${formatCueTime(cueEnd(segments, i), ",")}\n${norm(s.text)}`,
      )
      .join("\n\n") + "\n"
  );
}

export function toVtt(segments: Segment[]): string {
  const body = segments
    .map((s, i) => `${formatCueTime(s.start, ".")} --> ${formatCueTime(cueEnd(segments, i), ".")}\n${norm(s.text)}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function toJson(result: TranscriptResult): string {
  return JSON.stringify(result, null, 2) + "\n";
}

export function convert(result: TranscriptResult, format: Format): string {
  switch (format) {
    case "txt":
      return toPlainText(result.segments) + "\n";
    case "timestamped":
      return toTimestampedText(result.segments) + "\n";
    case "srt":
      return toSrt(result.segments);
    case "vtt":
      return toVtt(result.segments);
    case "json":
      return toJson(result);
  }
}

/** Safe-ish filename from the video title. */
export function fileName(result: Pick<TranscriptResult, "title" | "videoId">, format: Format): string {
  const base =
    result.title
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || result.videoId;
  const suffix = format === "timestamped" ? "-timestamps" : "";
  return `${base}-${result.videoId}${suffix}.${FORMAT_META[format].ext}`;
}
