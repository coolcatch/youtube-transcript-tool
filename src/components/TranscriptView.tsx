"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { convert, fileName, formatClock, FORMAT_META, toParagraphs, type Format } from "@/lib/format";
import type { TrackInfo, TranscriptResult } from "@/lib/types";
import UrlForm from "./UrlForm";

type State =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; tracks?: TrackInfo[] }
  | { status: "ready"; data: TranscriptResult };

const FRIENDLY: Record<string, string> = {
  NO_CAPTIONS: "This video doesn't have captions on YouTube, so there's no transcript to show.",
  VIDEO_UNAVAILABLE: "This video is private, removed, age-restricted or otherwise unavailable.",
  BLOCKED: "YouTube is temporarily blocking our server. Please try again in a minute.",
  UPSTREAM: "YouTube didn't answer properly. Please try again.",
  LANG_NOT_FOUND: "There's no transcript in that language.",
  INVALID_ID: "That doesn't look like a YouTube video.",
};

const DOWNLOADS: Format[] = ["txt", "srt", "vtt", "json"];

function download(data: TranscriptResult, format: Format) {
  const blob = new Blob([convert(data, format)], { type: FORMAT_META[format].mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(data, format);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TranscriptView({ videoId, lang }: { videoId: string; lang?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [showTimes, setShowTimes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playerStart, setPlayerStart] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ v: videoId });
    if (lang) qs.set("lang", lang);
    fetch(`/api/transcript?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || body.error) {
          const err = body?.error ?? {};
          setState({
            status: "error",
            code: err.code ?? "UPSTREAM",
            message: FRIENDLY[err.code] ?? err.message ?? `Request failed (${res.status}).`,
            tracks: err.tracks,
          });
          return;
        }
        setState({ status: "ready", data: body as TranscriptResult });
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setState({ status: "error", code: "NETWORK", message: "Couldn't reach the server. Check your connection and try again." });
      });
    return () => ctrl.abort();
  }, [videoId, lang, attempt]);

  // One option per language code (a video can have both a creator track and an auto one).
  const langOptions = useMemo(() => {
    if (state.status !== "ready") return [];
    const seen = new Set<string>();
    return state.data.tracks.filter((t) => (seen.has(t.languageCode) ? false : (seen.add(t.languageCode), true)));
  }, [state]);

  const paragraphs = useMemo(() => (state.status === "ready" ? toParagraphs(state.data.segments) : []), [state]);

  function changeLang(code: string) {
    router.push(`/transcript?v=${videoId}&lang=${encodeURIComponent(code)}`);
  }

  async function copy(data: TranscriptResult) {
    const text = convert(data, showTimes ? "timestamped" : "txt").trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers / non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state.status === "loading") {
    return (
      <div className="result" aria-busy="true" aria-live="polite">
        <div className="video-head skeleton-head">
          <div className="skeleton thumb" />
          <div className="skeleton-lines">
            <div className="skeleton line w80" />
            <div className="skeleton line w40" />
          </div>
        </div>
        <p className="loading-text">
          <span className="spinner" aria-hidden /> Fetching transcript…
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton para" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="state-card error" role="alert">
        <h1>Couldn&apos;t get this transcript</h1>
        <p>{state.message}</p>
        {state.tracks && state.tracks.length > 0 && (
          <div className="lang-choices">
            <p>Available languages:</p>
            {state.tracks.map((t) => (
              <button key={t.languageCode + t.kind} className="btn btn-ghost" onClick={() => changeLang(t.languageCode)}>
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="state-actions">
          {state.code !== "NO_CAPTIONS" && state.code !== "VIDEO_UNAVAILABLE" && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          )}
          <a className="btn btn-ghost" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">
            Open on YouTube
          </a>
        </div>
        <UrlForm compact />
      </div>
    );
  }

  const data = state.data;
  const empty = paragraphs.length === 0;

  return (
    <article className="result">
      <div className="video-head">
        <div className="media">
          {playerStart !== null ? (
            <iframe
              title={data.title}
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${Math.floor(playerStart)}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button className="thumb-btn" onClick={() => setPlayerStart(0)} aria-label="Play video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.thumbnailUrl} alt="" />
              <span className="play" aria-hidden>
                ▶
              </span>
            </button>
          )}
        </div>
        <div className="meta">
          <h1>
            <span className="muted-label">Transcript of</span> {data.title}
          </h1>
          <p className="author">
            {data.author && (
              <>
                By <strong>{data.author}</strong> ·{" "}
              </>
            )}
            {data.lengthSeconds ? `${formatClock(data.lengthSeconds)} · ` : ""}
            <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">
              Watch on YouTube
            </a>
          </p>
          <p className="track-note">
            {data.languageName}
            {data.isAutoGenerated && !/auto/i.test(data.languageName) ? " (auto-generated)" : ""}
          </p>
        </div>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Transcript actions">
        <button className="btn btn-primary btn-copy" onClick={() => copy(data)} disabled={empty}>
          {copied ? "✓ Copied!" : "Copy transcript"}
        </button>
        <label className="toggle">
          <input type="checkbox" checked={showTimes} onChange={(e) => setShowTimes(e.target.checked)} />
          <span className="toggle-ui" aria-hidden />
          Timestamps
        </label>
        {langOptions.length > 1 && (
          <label className="lang-select">
            <span className="sr-only">Language</span>
            <select value={data.language} onChange={(e) => changeLang(e.target.value)}>
              {langOptions.map((t) => (
                <option key={t.languageCode} value={t.languageCode}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="downloads">
          <span className="dl-label">Download</span>
          {DOWNLOADS.map((f) => (
            <button key={f} className="btn btn-ghost btn-sm" onClick={() => download(data, f)} disabled={empty}>
              {FORMAT_META[f].label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="transcript-heading">Transcript</h2>
      {empty ? (
        <div className="state-card">
          <p>This video&apos;s captions are empty.</p>
        </div>
      ) : (
        <div className={`transcript${showTimes ? " with-times" : ""}`}>
          {paragraphs.map((p, i) => (
            <p key={i}>
              {showTimes && (
                <button
                  className="ts"
                  onClick={() => {
                    setPlayerStart(p.start);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  title="Play from here"
                >
                  {formatClock(p.start)}
                </button>
              )}
              {p.text}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
