/**
 * All runtime configuration, read from environment variables.
 * Every variable is optional; see .env.example for docs.
 */
export interface Config {
  proxyUrl?: string;
  fallbacks: string[];
  fixtureMode: boolean;
  cacheTtlSeconds: number;
  cacheMaxEntries: number;
  requestTimeoutMs: number;
  thirdParty: { provider: string; apiKey?: string; baseUrl: string };
  whisper: { apiKey?: string; baseUrl: string; model: string; ytDlpPath: string };
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    proxyUrl: env.YT_PROXY_URL || undefined,
    fallbacks: (env.TRANSCRIPT_FALLBACKS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    fixtureMode: env.TRANSCRIPT_FIXTURE_MODE === "1",
    cacheTtlSeconds: num(env.TRANSCRIPT_CACHE_TTL_SECONDS, 6 * 3600),
    cacheMaxEntries: num(env.TRANSCRIPT_CACHE_MAX_ENTRIES, 200),
    requestTimeoutMs: num(env.YT_REQUEST_TIMEOUT_MS, 15000),
    thirdParty: {
      provider: (env.TRANSCRIPT_API_PROVIDER || "supadata").toLowerCase(),
      apiKey: env.TRANSCRIPT_API_KEY || undefined,
      baseUrl: env.TRANSCRIPT_API_BASE_URL || "https://api.supadata.ai/v1",
    },
    whisper: {
      apiKey: env.WHISPER_API_KEY || undefined,
      baseUrl: (env.WHISPER_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: env.WHISPER_MODEL || "whisper-1",
      ytDlpPath: env.YTDLP_PATH || "yt-dlp",
    },
  };
}
