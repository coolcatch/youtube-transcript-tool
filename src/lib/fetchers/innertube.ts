import { httpFetch, BROWSER_UA } from "../http";
import { parseTimedText } from "../xml";
import { TranscriptError, type TrackInfo, type TranscriptResult } from "../types";
import type { Fetcher } from "./types";

/**
 * Primary fetcher: YouTube's own caption data, no API key.
 *
 * 1. Ask the InnerTube "player" endpoint (as the ANDROID app) for the video's
 *    caption track list. This is what the YouTube app itself does and is the
 *    least likely to be blocked.
 * 2. If that fails, scrape `ytInitialPlayerResponse` from the watch page.
 * 3. Download the chosen track's timedtext XML and parse it.
 *
 * The client version below may need bumping if YouTube starts rejecting it
 * (see HANDOFF.md → "When YouTube breaks things").
 */
export const ANDROID_CLIENT = { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30 };

interface RawTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
  vssId?: string;
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { videoId?: string; title?: string; author?: string; lengthSeconds?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: RawTrack[] } };
}

function trackName(t: RawTrack): string {
  return t.name?.simpleText ?? t.name?.runs?.map((r) => r.text).join("") ?? t.languageCode;
}

export function toTrackInfo(t: RawTrack): TrackInfo {
  return { languageCode: t.languageCode, name: trackName(t), kind: t.kind === "asr" ? "asr" : "manual" };
}

/**
 * Pick a track. With `lang`: exact code, then same base language (en-GB → en).
 * Without: creator-uploaded English, any English, first creator-uploaded, first.
 */
export function pickTrack<T extends { languageCode: string; kind?: string }>(tracks: T[], lang?: string): T | undefined {
  if (!tracks.length) return undefined;
  const manualFirst = (a: T, b: T) => (a.kind === "asr" ? 1 : 0) - (b.kind === "asr" ? 1 : 0);
  const sorted = [...tracks].sort(manualFirst);
  if (lang) {
    const l = lang.toLowerCase();
    return (
      sorted.find((t) => t.languageCode.toLowerCase() === l) ??
      sorted.find((t) => t.languageCode.toLowerCase().split("-")[0] === l.split("-")[0])
    );
  }
  return (
    sorted.find((t) => t.languageCode.toLowerCase().startsWith("en") && t.kind !== "asr") ??
    sorted.find((t) => t.languageCode.toLowerCase().startsWith("en")) ??
    sorted[0]
  );
}

async function playerViaAndroid(videoId: string): Promise<PlayerResponse> {
  const res = await httpFetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `com.google.android.youtube/${ANDROID_CLIENT.clientVersion} (Linux; U; Android 11) gzip`,
    },
    body: JSON.stringify({ context: { client: { ...ANDROID_CLIENT, hl: "en", gl: "US" } }, videoId }),
  });
  if (res.status === 429) throw new TranscriptError("BLOCKED", "YouTube is rate-limiting this server (HTTP 429).");
  if (!res.ok) throw new TranscriptError("UPSTREAM", `YouTube player API returned HTTP ${res.status}.`);
  return (await res.json()) as PlayerResponse;
}

async function playerViaWatchPage(videoId: string): Promise<PlayerResponse> {
  const res = await httpFetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
  });
  if (res.status === 429) throw new TranscriptError("BLOCKED", "YouTube is rate-limiting this server (HTTP 429).");
  const html = await res.text();
  if (html.includes('action="https://consent.youtube.com')) {
    throw new TranscriptError("BLOCKED", "YouTube showed a cookie-consent wall to this server.");
  }
  if (html.includes("g-recaptcha") || html.includes("/sorry/")) {
    throw new TranscriptError("BLOCKED", "YouTube asked this server to solve a captcha (IP is flagged).");
  }
  const m = /ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;\s*(?:var\s|<\/script>)/.exec(html);
  if (!m) throw new TranscriptError("UPSTREAM", "Could not find player data on the YouTube watch page.");
  return JSON.parse(m[1]) as PlayerResponse;
}

function checkPlayability(p: PlayerResponse) {
  const status = p.playabilityStatus?.status;
  const reason = p.playabilityStatus?.reason ?? "";
  if (!status || status === "OK") return;
  if (status === "LOGIN_REQUIRED" && /bot|sign in to confirm/i.test(reason)) {
    throw new TranscriptError("BLOCKED", `YouTube blocked this server: "${reason}"`);
  }
  if (status === "LOGIN_REQUIRED") {
    throw new TranscriptError("VIDEO_UNAVAILABLE", reason || "This video needs a login (private or age-restricted).");
  }
  throw new TranscriptError("VIDEO_UNAVAILABLE", reason || `This video is unavailable (${status}).`);
}

async function fromPlayer(videoId: string, lang: string | undefined, p: PlayerResponse, source: string) {
  checkPlayability(p);
  const raw = p.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const tracks = raw.map(toTrackInfo);
  if (!raw.length) throw new TranscriptError("NO_CAPTIONS", "This video has no captions or transcript on YouTube.");

  const chosen = pickTrack(raw, lang);
  if (!chosen) {
    throw new TranscriptError("LANG_NOT_FOUND", `No "${lang}" transcript. Available: ${tracks.map((t) => t.languageCode).join(", ")}`, tracks);
  }

  // Strip any fmt= so we get the simple "format 1" XML (<text start dur>).
  const url = chosen.baseUrl.replace(/&fmt=[^&]*/g, "");
  const res = await httpFetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (res.status === 429) throw new TranscriptError("BLOCKED", "YouTube is rate-limiting caption downloads (HTTP 429).");
  if (!res.ok) throw new TranscriptError("UPSTREAM", `Caption download failed (HTTP ${res.status}).`);
  const xml = await res.text();
  const segments = parseTimedText(xml);
  if (!segments.length && xml.trim() === "") {
    throw new TranscriptError("BLOCKED", "YouTube returned an empty caption file (often a sign the IP is blocked).");
  }

  const info = toTrackInfo(chosen);
  const vd = p.videoDetails ?? {};
  const result: TranscriptResult = {
    videoId,
    title: vd.title ?? "Untitled video",
    author: vd.author ?? "",
    lengthSeconds: vd.lengthSeconds ? Number(vd.lengthSeconds) : undefined,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    language: info.languageCode,
    languageName: info.name,
    isAutoGenerated: info.kind === "asr",
    tracks,
    segments,
    source,
    fetchedAt: new Date().toISOString(),
  };
  return result;
}

export const innertubeFetcher: Fetcher = {
  name: "innertube",
  async fetch(videoId, lang) {
    let firstErr: unknown;
    try {
      return await fromPlayer(videoId, lang, await playerViaAndroid(videoId), "innertube-android");
    } catch (e) {
      // Definitive answers about the video itself: don't bother retrying.
      if (e instanceof TranscriptError && ["NO_CAPTIONS", "LANG_NOT_FOUND"].includes(e.code)) throw e;
      firstErr = e;
    }
    try {
      return await fromPlayer(videoId, lang, await playerViaWatchPage(videoId), "watch-page");
    } catch (e) {
      if (e instanceof TranscriptError && e.code !== "UPSTREAM") throw e;
      throw firstErr instanceof TranscriptError ? firstErr : e;
    }
  },
};
