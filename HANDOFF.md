# HANDOFF: YouTube Transcript Tool

Written 2026-11-21 (America/Toronto) by Grok Bot for **the next Grok / AI agent**. Assume you have **no access** to the chat that produced this. Everything you need is here and in the code.

---

## 1. What this is and who it's for

- **Owner:** Lisa Villary (GitHub `coolcatch`), a Toronto-based creator of digital products (Etsy, KDP, POD, Gumroad) and a YouTube channel ("I build digital products with AI").
- **Goal:** a free, simple, ad-free **YouTube → transcript** web tool that copies the UX of <https://youtubetotranscript.com> (see the example <https://youtubetotranscript.com/transcript?v=Eux-VGsdw8o>): paste a link, get the transcript, big copy button, blue, minimal.
- **Uses:** turning her own and other videos into notes, blog posts, listing copy and AI prompts. Possibly a public tool later.
- **Repo:** <https://github.com/coolcatch/youtube-transcript-tool>. Work started on branch `feature/transcript-app` (PR against `main`). Lisa also has a second GitHub account (`labtrysketch`, repo `labtrysketch/youtube-transcript-tool-`), which is **unused so far**. Ask her before moving anything there.

### House rules from Lisa (keep following them)
1. **Do not deploy publicly, merge to `main`, or publish anything without Lisa's explicit OK.** Draft/PR is fine.
2. **Document everything.** Every work session gets a timestamped (America/Toronto) entry in her work log (see §13).
3. Never commit secrets. Keys go in Vercel env vars or `.env.local` (git-ignored).
4. Keep it minimal, blue, no ads, no tracking.

---

## 2. Status (2026-11-21)

| Area | Status |
|---|---|
| Web UI (home, result, states) | ✅ Done, screenshots in `docs/screenshots/` |
| Primary fetch (YouTube captions, no key) | ✅ **Works from a residential/VM IP**: real fetch of `Eux-VGsdw8o` returned 656 cues, 21 languages |
| Downloads txt/srt/vtt/json, copy, timestamps, language picker | ✅ Done |
| API route + CLI | ✅ Done, tested manually against real YouTube |
| Unit tests | ✅ 59 passing (`npm test`) |
| `npm run build`, `npm run lint`, `tsc` | ✅ Clean |
| Vercel deploy | ⏸ **Not deployed** (waiting for Lisa). Repo is zero-config Vercel-ready. |
| Works from Vercel IPs? | ❓ **Unknown until deployed.** YouTube often blocks cloud IPs (see §7). |
| Third-party API fallback (Supadata) | ⚠️ Implemented from docs, **untested** (no key) |
| Whisper fallback | ⚠️ Implemented, **untested** (no key); needs `yt-dlp`, so CLI/self-host only |

---

## 3. Architecture

```
Browser ──► /                       (static page, UrlForm)
   │            └─ parseVideoId() client-side → router.push(/transcript?v=ID)
   ▼
/transcript?v=ID&lang=xx            (server component: validates v, renders TranscriptView)
   │
   └─ TranscriptView (client) ──fetch──► GET /api/transcript?v=ID&lang=xx
                                              │  (Node runtime, maxDuration 30s)
                                              ▼
                                       getTranscript(id, lang)   src/lib/transcript.ts
                                              │ in-memory TtlCache hit? → return
                                              ▼
                                       fetcher chain (first success wins)
                                        1. innertube  (ANDROID player API → timedtext XML)
                                           └ fallback inside: watch-page ytInitialPlayerResponse
                                        2. thirdparty (only if TRANSCRIPT_FALLBACKS has it + key)
                                        3. whisper    (only if TRANSCRIPT_FALLBACKS has it + key + yt-dlp)
                                        (fixture mode replaces the whole chain)
                                              ▼
                                       TranscriptResult JSON  ──► UI groups cues into paragraphs
                                                                  (toParagraphs) and does copy /
                                                                  downloads client-side (convert()).
```

- Formatting (paragraphs, SRT, VTT, txt, JSON) is **pure functions** in `src/lib/format.ts`, shared by UI, API and CLI.
- Downloads in the UI are generated **client-side** from the JSON already loaded (no second request). The API also supports `&format=` for direct links and scripts.
- Caching: per-instance memory (`TtlCache`, 6 h, 200 entries) plus `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` on success so Vercel's CDN absorbs repeats. Errors are `no-store`.

## 4. File map

| Path | Purpose |
|---|---|
| `src/app/layout.tsx` | Header (blue bar), footer, metadata |
| `src/app/page.tsx` | Home: hero, `UrlForm`, 3 feature cards |
| `src/app/transcript/page.tsx` | Result route. Handles missing `v` (empty state) and an unparseable `v` (error state), else renders `TranscriptView` keyed by `id:lang` |
| `src/app/api/transcript/route.ts` | API. Validates `v`/`lang`/`format`, maps `TranscriptError` → HTTP status |
| `src/app/not-found.tsx` | 404 |
| `src/app/globals.css` | All styling (CSS variables, blue palette, mobile breakpoint 640px). No Tailwind on purpose |
| `src/components/UrlForm.tsx` | Input + "Get transcript" button, inline error |
| `src/components/TranscriptView.tsx` | Loading skeleton, error card (retry, language suggestions), result: thumbnail→nocookie embed, toolbar (copy, timestamps, language select, downloads), paragraphs, clickable timestamps |
| `src/lib/parseVideoId.ts` | URL → 11-char ID. **Extend here** for new URL shapes (+ add a test) |
| `src/lib/format.ts` | `toParagraphs`, `toPlainText`, `toTimestampedText`, `toSrt`, `toVtt`, `toJson`, `convert`, `fileName`, time formatters |
| `src/lib/xml.ts` | Timedtext XML parser (format 1 and srv3) + entity decoding (handles YouTube's double encoding `&amp;#39;`) |
| `src/lib/types.ts` | `Segment`, `TrackInfo`, `TranscriptResult`, `TranscriptError` (+ code → HTTP status) |
| `src/lib/config.ts` | Reads every env var in one place |
| `src/lib/http.ts` | `httpFetch()` = fetch + timeout + optional proxy (undici `ProxyAgent`) |
| `src/lib/cache.ts` | `TtlCache` |
| `src/lib/transcript.ts` | `getTranscript()` + `fetcherChain()`; decides which errors stop the chain |
| `src/lib/fetchers/innertube.ts` | **Primary fetcher.** `ANDROID_CLIENT` version constant, `pickTrack()`, player API + watch-page fallback |
| `src/lib/fetchers/thirdParty.ts` | Supadata fallback |
| `src/lib/fetchers/whisper.ts` | yt-dlp + OpenAI-compatible transcription fallback |
| `src/lib/fetchers/fixture.ts` | Serves `fixtures/<id>.json` when `TRANSCRIPT_FIXTURE_MODE=1` |
| `src/lib/fetchers/oembed.ts` | Title/channel for fallbacks |
| `scripts/transcript.ts` | CLI |
| `scripts/screenshots.ts` | Playwright screenshots against a running server |
| `fixtures/fixture0001.json` | **Synthetic** transcript (not real YouTube content), ID `fixture0001` |
| `public/fixture-thumb.svg` | Fixture thumbnail |
| `tests/*.test.ts` | Vitest: parseVideoId, format, xml, cache, innertube (mocked `fetch`) |
| `.env.example` | Every env var, documented |
| `DEPENDENCIES.md` | Dependency + license inventory |

## 5. Data model

```ts
Segment          { start: number /*s*/, duration: number /*s*/, text: string }
TrackInfo        { languageCode: string, name: string, kind: "asr" | "manual" }
TranscriptResult { videoId, title, author, lengthSeconds?, thumbnailUrl, language, languageName,
                   isAutoGenerated, tracks: TrackInfo[], segments: Segment[], source, fetchedAt }
TranscriptError  codes: INVALID_ID 400 · VIDEO_UNAVAILABLE 404 · NO_CAPTIONS 404 · LANG_NOT_FOUND 404
                        BLOCKED 503 · UPSTREAM 502 · NOT_CONFIGURED 501
```

## 6. How fetching works (details)

1. `POST https://www.youtube.com/youtubei/v1/player?prettyPrint=false` with body
   `{ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl, gl } }, videoId }`.
   The ANDROID client currently returns `captions.playerCaptionsTracklistRenderer.captionTracks[]` without needing a PoToken. The WEB client increasingly does not.
2. `playabilityStatus` is checked: `LOGIN_REQUIRED` + "bot" → `BLOCKED`, other non-OK → `VIDEO_UNAVAILABLE`.
3. `pickTrack(tracks, lang)`: with `lang` exact match, then base language (`fr-CA`→`fr`), creator tracks before auto. Without `lang`: creator English → any English → first creator track → first.
4. Fetch `track.baseUrl` with any `&fmt=…` removed → "format 1" XML `<text start dur>`. Parser also handles srv3 just in case.
5. If step 1 fails for a reason other than NO_CAPTIONS/LANG_NOT_FOUND, retry via the watch page (`ytInitialPlayerResponse` regex; detects consent wall / captcha → `BLOCKED`).
6. Observed 2026-11-21: `Eux-VGsdw8o` lists 21 "auto-generated" languages. These are YouTube's AI auto-dub tracks, which is why `fr` returns French text.

### When YouTube breaks things (most likely maintenance task)
- **Symptom: empty captionTracks or `UPSTREAM` for every video.** YouTube may have retired the client version. Bump `ANDROID_CLIENT.clientVersion` in `innertube.ts` to a current YouTube Android version (check what yt-dlp uses in `yt_dlp/extractor/youtube/_base.py` → `INNERTUBE_CLIENTS['android']`), or switch to another client yt-dlp marks as not needing a PoToken for subtitles.
- **Symptom: timedtext returns HTTP 200 with an empty body.** The caption URL now needs a PoToken (`&pot=`) or the IP is flagged. Try the proxy, or the `thirdparty` fallback.
- Run `npm run transcript -- Eux-VGsdw8o | head` to check quickly.

## 7. YouTube blocking: mitigations

YouTube rate-limits and bot-checks **datacenter IPs** (AWS/GCP, which includes Vercel). From the build box (a VM) it worked fine; from Vercel it is **untested**. Mitigation ladder, cheapest first:
1. **Caching** (already on): CDN `s-maxage` plus memory cache, so a repeated video never hits YouTube.
2. **`YT_PROXY_URL`**: a residential/rotating HTTP proxy. All YouTube calls go through it (undici `ProxyAgent`). Paid proxies are ~$3–10/GB, and transcripts are tiny.
3. **`TRANSCRIPT_FALLBACKS=thirdparty` + `TRANSCRIPT_API_KEY`**: Supadata (or add another provider). They handle blocking for you. Paid per request with a free tier.
4. Self-host on a VPS/home server with a residential IP. **Do not use Lisa's VPS 46.202.176.136. It runs her Moodle site and must be left alone.**
5. Client-side fetching from the user's browser is **not possible** (CORS on youtube.com).

The UI shows a friendly "YouTube is temporarily blocking our server" for `BLOCKED`.

## 8. Environment variables
See `.env.example` (authoritative, with comments) and the README table. Summary: `YT_PROXY_URL`, `YT_REQUEST_TIMEOUT_MS`, `TRANSCRIPT_CACHE_TTL_SECONDS`, `TRANSCRIPT_CACHE_MAX_ENTRIES`, `TRANSCRIPT_FALLBACKS`, `TRANSCRIPT_API_PROVIDER`, `TRANSCRIPT_API_KEY`, `TRANSCRIPT_API_BASE_URL`, `WHISPER_API_KEY`, `WHISPER_API_BASE_URL`, `WHISPER_MODEL`, `YTDLP_PATH`, `TRANSCRIPT_FIXTURE_MODE`. All are optional. With none set, the app runs with YouTube only.

## 9. Tests & quality gates
```bash
npm test          # 59 vitest tests, ~1 s, no network (fetch is mocked)
npm run lint      # eslint-config-next (core-web-vitals + typescript)
npm run typecheck
npm run build
```
- Add a test in `tests/parseVideoId.test.ts` for every new URL shape, and in `tests/format.test.ts` for formatter changes.
- Manual real-network smoke test: `npm run transcript -- https://youtu.be/Eux-VGsdw8o --format srt | head`.
- Screenshots: `npm run build && TRANSCRIPT_FIXTURE_MODE=1 npx next start -p 3401` then `CHROME_PATH=/usr/bin/google-chrome BASE_URL=http://localhost:3401 OUT_DIR=/tmp/shots npm run screenshots` (or `npx playwright install chromium` and omit `CHROME_PATH`).
- No CI is configured yet (see roadmap #2).

## 10. Deploy process (Vercel)
**Only with Lisa's OK.** Steps are in README → *Deploy to Vercel*. In short: Vercel → Add New Project → import `coolcatch/youtube-transcript-tool` → Deploy (no env vars needed) → smoke-test with `Eux-VGsdw8o`. If `BLOCKED`, add `YT_PROXY_URL` or the third-party fallback.
`maxDuration = 30` is set on the API route (Hobby plan allows up to 60 s). PRs get preview deployments automatically once the project is connected.

## 11. Decisions & why

| Decision | Why |
|---|---|
| Own InnerTube code instead of the `youtube-transcript` npm package | The popular packages scrape the WEB watch page, which broke repeatedly in 2025 (PoToken). The ANDROID player call works today, and owning ~200 lines makes fixes a one-line version bump. |
| Plain CSS, no Tailwind/UI kit | Tiny surface, zero config, easy for any agent to edit. |
| Client-side downloads | Instant, no extra serverless calls or YouTube hits. |
| Client fetch from `/transcript` (not server-rendered transcript) | Shows a loading state immediately; the page never times out; the API is reusable by the CLI and other tools. Trade-off: transcript text isn't in the HTML for SEO (roadmap #5). |
| `youtube-nocookie.com` embed loaded only on click | Matches "no tracking": no Google requests until the user chooses to play. |
| Fallbacks off by default | They cost money; Lisa decides when to pay. |
| Synthetic fixture instead of a real transcript | Avoids committing someone else's copyrighted text. |
| Next 16 (not 15) | Next 15 pulled a vulnerable postcss (npm audit high). 16 has 0 vulnerabilities. Note: `next lint` is gone in 16, so lint runs `eslint .`. |

## 12. Known limitations
- Unknown behaviour from Vercel IPs (see §7). This is the #1 risk.
- In-memory cache is per serverless instance and resets on cold start.
- No rate limiting. A public deployment could be abused to hammer YouTube through our IP.
- The language picker shows one entry per language code. If a video has both a creator and an auto track for the same code, the creator one wins.
- Paragraph splitting is heuristic (sentence ends + ~350–900 chars + 4 s silences). Auto captions without punctuation become ~900-char blocks.
- Supadata and Whisper fallbacks are untested. Whisper can't run on Vercel (needs the yt-dlp binary, 4.5 MB request limit, OpenAI's 25 MB file limit, so long videos need chunking).
- No playlist/channel support, no history, no AI summary yet.
- Live streams in progress and members-only/age-restricted videos return `VIDEO_UNAVAILABLE`/`NO_CAPTIONS`.

## 13. Documentation duty (Lisa's rule)
After each session append a timestamped America/Toronto entry to:
- `/workspace/grok-studio-2026-11/00_ADMIN/WORK_LOG.md` (on the Grok Bot box), and
- the **Work Log** tab of the studio tracker sheet <https://docs.google.com/spreadsheets/d/10fCnBZVKdicLvjI8aQ07mzxcG3_5GbDFMnffn-B3OGw/edit>.
- Keep the **Templates & Generators** tab row for this tool current (status `Needs Testing` until deployed and checked on Vercel).
- Update `CHANGELOG.md` with each change.
- Copies of this file and README live in Drive: studio folder → `06_TEMPLATES_AND_GENERATORS`. Re-upload after big changes.

## 14. Ranked roadmap
1. **Deploy to Vercel (after Lisa's OK) and verify it works from Vercel IPs.** If blocked, wire a proxy or the Supadata key and document the cost.
2. **CI:** a GitHub Actions workflow running `npm ci && npm run lint && npm run typecheck && npm test && npm run build` on PRs.
3. **Rate limiting** on `/api/transcript` (e.g. Upstash Redis or Vercel KV token bucket per IP) before any public launch.
4. **AI summary / "Clean transcript" / notes** (like youtubetotranscript's AI Features: clean transcript, Cornell notes, key points). Server route with `AI_API_KEY` (xAI or OpenAI-compatible), off by default, streamed. Lisa has xAI API credits.
5. **SEO:** server-render title + first paragraphs on `/transcript` (or `generateMetadata` with the title) if this becomes a public traffic tool.
6. **History:** recent videos in `localStorage` (no server tracking).
7. **Playlists / channels:** list video IDs (InnerTube `browse`) and a bulk ZIP download.
8. **Search within transcript** + highlight; "copy from here" per paragraph.
9. Better paragraphing for unpunctuated auto captions (optionally via the AI route).
10. Persistent cache (Vercel KV / Blob) shared across instances.

## 15. Your first task, next agent
1. Read this file, then run `npm ci && npm test && npm run build` and `npm run transcript -- https://youtu.be/Eux-VGsdw8o | head -c 300` to confirm the YouTube fetch still works.
2. Check the PR `feature/transcript-app` on GitHub. **Do not merge without Lisa's OK.**
3. Ask Lisa (via your owner/parent) whether she approves a Vercel deploy. If yes, follow §10 and test from the live URL. Record the result (works / blocked) in WORK_LOG.md, the tracker and CHANGELOG.
4. Then do roadmap #2 (CI) on a new branch + PR.
