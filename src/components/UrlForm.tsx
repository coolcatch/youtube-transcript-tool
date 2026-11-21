"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseVideoId } from "@/lib/parseVideoId";

export default function UrlForm({ initial = "", compact = false }: { initial?: string; compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = parseVideoId(value);
    if (!id) {
      setError("That doesn't look like a YouTube link. Try something like https://www.youtube.com/watch?v=… or youtu.be/…");
      return;
    }
    setError(null);
    router.push(`/transcript?v=${id}`);
  }

  return (
    <form className={`url-form${compact ? " compact" : ""}`} onSubmit={submit} noValidate>
      <label htmlFor="yt-url" className="sr-only">
        YouTube video link
      </label>
      <div className="url-row">
        <input
          id="yt-url"
          name="v"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste a YouTube link, e.g. https://www.youtube.com/watch?v=…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "yt-url-error" : undefined}
        />
        <button type="submit" className="btn btn-primary btn-lg">
          Get transcript
        </button>
      </div>
      {error && (
        <p id="yt-url-error" className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
