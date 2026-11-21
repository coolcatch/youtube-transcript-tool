import type { Metadata } from "next";
import UrlForm from "@/components/UrlForm";
import TranscriptView from "@/components/TranscriptView";
import { parseVideoId } from "@/lib/parseVideoId";

type SP = Promise<{ v?: string | string[]; lang?: string | string[] }>;

const first = (x: string | string[] | undefined) => (Array.isArray(x) ? x[0] : x) ?? "";

export const metadata: Metadata = { title: "Transcript: YouTube Transcript Generator" };

export default async function TranscriptPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = first(sp.v);
  const id = parseVideoId(raw);
  const lang = first(sp.lang) || undefined;

  if (!raw) {
    return (
      <div className="state-card">
        <h1>No video yet</h1>
        <p>Paste a YouTube link to get its transcript.</p>
        <UrlForm compact />
      </div>
    );
  }
  if (!id) {
    return (
      <div className="state-card error">
        <h1>That link doesn&apos;t look right</h1>
        <p>We couldn&apos;t find a YouTube video ID in “{raw}”.</p>
        <UrlForm compact initial={raw} />
      </div>
    );
  }
  return <TranscriptView key={`${id}:${lang ?? ""}`} videoId={id} lang={lang} />;
}
