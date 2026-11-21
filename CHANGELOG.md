# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/), versions: SemVer.

## [Unreleased] - 2026-11-21

### Documentation (final handoff, 12:15 EST)
- New `AI_HANDOFF.md`: a standalone handoff for any AI or developer (architecture, file map, verified status, known bugs, services, rules, prioritised tasks).
- New `SECURITY_REVIEW.md`: key handling, client-bundle and git-history secret scans (gitleaks: clean), credit-abuse risk, validation and error handling, plus prioritised fixes F1–F9 (proposals only).
- `README.md` rewritten: features, stack, local setup, extraction flow, Supadata integration, API, a full env var table (where each one belongs), Vercel deploy/maintenance/rollback, troubleshooting.
- `.env.example`: notes on where each variable belongs (still placeholders only).
- Live URL recorded everywhere: https://youtube-transcript-tool-flax.vercel.app/
- No application code changed.

### Documentation
- Deployed to Vercel by Lisa (PR #1 merged). Live URL: https://youtube-transcript-tool-flax.vercel.app/
- Recorded that YouTube blocks direct fetching from Vercel. Production uses the Supadata fallback (free plan, 100 transcripts/month, no rollover; key only in Vercel env vars), which Lisa confirmed working at 02:07 EST.
- HANDOFF.md: new §0 "Current deployment status" with the quota risk and next steps. Updated the status table, limitations, roadmap and the next agent's first task (friendly "monthly limit reached" handling).
- README: deploy section now explains the Vercel blocking and the Supadata env vars.

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
