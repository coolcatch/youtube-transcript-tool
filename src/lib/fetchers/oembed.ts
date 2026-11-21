import { httpFetch } from "../http";

/** Title + channel via YouTube's public oEmbed endpoint (used by fallbacks). */
export async function getOEmbed(videoId: string): Promise<{ title: string; author: string }> {
  try {
    const res = await httpFetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
    );
    if (!res.ok) return { title: "Untitled video", author: "" };
    const j = (await res.json()) as { title?: string; author_name?: string };
    return { title: j.title ?? "Untitled video", author: j.author_name ?? "" };
  } catch {
    return { title: "Untitled video", author: "" };
  }
}
