const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "gaming.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** True when the string is exactly an 11-character YouTube video ID. */
export function isValidVideoId(id: string): boolean {
  return ID_RE.test(id);
}

/**
 * Pull the 11-character video ID out of anything a person might paste:
 * watch?v=, youtu.be/, /shorts/, /embed/, /live/, /v/, music/m. subdomains,
 * youtube-nocookie, URLs without a scheme, or a bare ID.
 * Returns null when no valid ID can be found.
 */
export function parseVideoId(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (isValidVideoId(raw)) return raw;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "www.youtu.be") {
    return parts[0] && isValidVideoId(parts[0]) ? parts[0] : null;
  }

  if (!YT_HOSTS.has(host)) return null;

  const v = url.searchParams.get("v");
  if (v && isValidVideoId(v)) return v;

  if (parts.length >= 2 && ["shorts", "embed", "live", "v", "e"].includes(parts[0])) {
    return isValidVideoId(parts[1]) ? parts[1] : null;
  }

  // /attribution_link?u=/watch%3Fv%3DID
  const u = url.searchParams.get("u");
  if (u) return parseVideoId(`https://www.youtube.com${u.startsWith("/") ? "" : "/"}${u}`);

  return null;
}
