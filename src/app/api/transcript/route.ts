import { NextResponse, type NextRequest } from "next/server";
import { convert, fileName, FORMAT_META, isFormat } from "@/lib/format";
import { parseVideoId } from "@/lib/parseVideoId";
import { getTranscript } from "@/lib/transcript";
import { TranscriptError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/transcript?v=<url or id>&lang=<code>&format=<txt|timestamped|srt|vtt|json>
 * Without `format` → JSON TranscriptResult (what the UI uses).
 * With `format` → the file as a download.
 * Errors → { error: { code, message, tracks? } } with a matching HTTP status.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = parseVideoId(sp.get("v") ?? "");
  const lang = sp.get("lang")?.trim() || undefined;
  const format = sp.get("format");

  if (!id) {
    return NextResponse.json(
      { error: { code: "INVALID_ID", message: "Paste a YouTube link or an 11-character video ID." } },
      { status: 400 },
    );
  }
  if (format && !isFormat(format)) {
    return NextResponse.json({ error: { code: "INVALID_FORMAT", message: `Unknown format "${format}".` } }, { status: 400 });
  }
  if (lang && !/^[A-Za-z0-9-]{2,15}$/.test(lang)) {
    return NextResponse.json({ error: { code: "INVALID_LANG", message: "Bad language code." } }, { status: 400 });
  }

  try {
    const result = await getTranscript(id, lang);
    // Let Vercel's CDN cache successful responses for an hour.
    const cacheHeaders = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };
    if (format && isFormat(format)) {
      return new NextResponse(convert(result, format), {
        headers: {
          ...cacheHeaders,
          "Content-Type": FORMAT_META[format].mime,
          "Content-Disposition": `attachment; filename="${fileName(result, format)}"`,
        },
      });
    }
    return NextResponse.json(result, { headers: cacheHeaders });
  } catch (e) {
    if (e instanceof TranscriptError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message, tracks: e.tracks } },
        { status: e.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("transcript route error", e);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
