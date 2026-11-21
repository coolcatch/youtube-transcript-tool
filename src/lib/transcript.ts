import { TtlCache } from "./cache";
import { getConfig } from "./config";
import { fixtureFetcher } from "./fetchers/fixture";
import { innertubeFetcher } from "./fetchers/innertube";
import { thirdPartyFetcher } from "./fetchers/thirdParty";
import { whisperFetcher } from "./fetchers/whisper";
import type { Fetcher } from "./fetchers/types";
import { isValidVideoId } from "./parseVideoId";
import { TranscriptError, type TranscriptResult } from "./types";

const FALLBACKS: Record<string, Fetcher> = {
  thirdparty: thirdPartyFetcher,
  whisper: whisperFetcher,
};

let cache: TtlCache<TranscriptResult> | null = null;
function getCache() {
  if (!cache) {
    const c = getConfig();
    cache = new TtlCache<TranscriptResult>(c.cacheTtlSeconds * 1000, c.cacheMaxEntries);
  }
  return cache;
}

/** The ordered chain of fetchers for the current environment. */
export function fetcherChain(): Fetcher[] {
  const cfg = getConfig();
  if (cfg.fixtureMode) return [fixtureFetcher];
  return [innertubeFetcher, ...cfg.fallbacks.map((n) => FALLBACKS[n]).filter(Boolean)];
}

/**
 * Get a transcript, trying each fetcher in order. Errors that are facts about
 * the video (unavailable, wrong language) stop the chain; NO_CAPTIONS and
 * BLOCKED/UPSTREAM move on to the next fetcher (if any are enabled).
 */
export async function getTranscript(videoId: string, lang?: string): Promise<TranscriptResult> {
  if (!isValidVideoId(videoId)) throw new TranscriptError("INVALID_ID", "That doesn't look like a YouTube video ID.");
  const key = `${videoId}:${lang ?? ""}`;
  const cached = getCache().get(key);
  if (cached) return cached;

  let lastErr: unknown;
  for (const f of fetcherChain()) {
    try {
      const result = await f.fetch(videoId, lang);
      getCache().set(key, result);
      return result;
    } catch (e) {
      // Keep the more useful error: a misconfigured fallback shouldn't hide "BLOCKED".
      if (!(e instanceof TranscriptError && e.code === "NOT_CONFIGURED" && lastErr)) lastErr = e;
      if (e instanceof TranscriptError && ["INVALID_ID", "VIDEO_UNAVAILABLE", "LANG_NOT_FOUND"].includes(e.code)) throw e;
    }
  }
  if (lastErr instanceof TranscriptError) throw lastErr;
  throw new TranscriptError("UPSTREAM", lastErr instanceof Error ? lastErr.message : "Unknown error fetching transcript.");
}
