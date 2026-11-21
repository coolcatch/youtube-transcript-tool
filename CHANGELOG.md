# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/), versions: SemVer.

## [0.1.0] - 2026-11-21

### Added
- Next.js 16 (App Router, TypeScript) web app styled after youtubetotranscript.com: blue, minimal, mobile-friendly.
- Home page with a big URL input + "Get transcript" button and inline validation.
- Result page `/transcript?v=ID[&lang=xx]`: thumbnail (click to play a privacy-mode embed), title, channel, length, "Transcript" heading, transcript in readable paragraphs.
- Sticky toolbar: **Copy transcript**, timestamps toggle (clickable timestamps seek the embedded player), language picker when several caption tracks exist, downloads **.txt / .srt / .vtt / .json**.
- Loading skeleton, empty state, error states with friendly messages, retry and language suggestions.
- URL parsing for watch?v=, youtu.be, /shorts/, /embed/, /live/, /v/, m./music./nocookie hosts, attribution links, scheme-less URLs and bare IDs.
- API `GET /api/transcript?v=&lang=&format=` (JSON by default, file download with `format`).
- Pluggable fetcher chain: YouTube InnerTube (ANDROID client) → watch-page scrape → optional Supadata API → optional Whisper-compatible transcription. Fallbacks off by default.
- Optional `YT_PROXY_URL`, in-memory TTL cache + CDN `Cache-Control`, fixture mode for offline dev/screenshots.
- CLI: `npm run transcript -- <url> --format txt|timestamped|srt|vtt|json [--lang xx] [--out file]`.
- 59 vitest unit tests (URL parsing, formatters, XML parsing, cache, fetcher with mocked network).
- Docs: README, HANDOFF (for the next agent), DEPENDENCIES, `.env.example`, MIT LICENSE.
