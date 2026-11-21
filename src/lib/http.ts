import { getConfig } from "./config";

/**
 * fetch() with a timeout and the optional YT_PROXY_URL.
 * When a proxy is configured we use undici's fetch + ProxyAgent
 * (works on Vercel's Node runtime). Otherwise the global fetch.
 */
export async function httpFetch(url: string, init: RequestInit & { useProxy?: boolean } = {}): Promise<Response> {
  const cfg = getConfig();
  const { useProxy = true, ...rest } = init;
  const signal = AbortSignal.timeout(cfg.requestTimeoutMs);
  if (useProxy && cfg.proxyUrl) {
    const { fetch: uFetch, ProxyAgent } = await import("undici");
    const res = await uFetch(url, {
      ...(rest as Record<string, unknown>),
      signal,
      dispatcher: new ProxyAgent(cfg.proxyUrl),
    } as Parameters<typeof uFetch>[1]);
    return res as unknown as Response;
  }
  return fetch(url, { ...rest, signal });
}

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
