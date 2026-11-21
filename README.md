# YouTube Transcript Tool

**Live:** <https://youtube-transcript-tool-flax.vercel.app/>  ·  **Repo:** <https://github.com/coolcatch/youtube-transcript-tool>  ·  **License:** MIT

Paste a YouTube link and get the video's transcript. Copy it with one click, or download it as `.txt`, `.srt`, `.vtt` or `.json`.
It's a small clone of the youtubetotranscript.com flow, with no ads and no tracking. It's built with Next.js and runs on Vercel.

> **Taking over this project (human or AI)?** Read [`AI_HANDOFF.md`](./AI_HANDOFF.md) first. It's the standalone handoff.
> Security notes are in [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md). `HANDOFF.md` is the earlier, more detailed engineering log.

![Home](docs/screenshots/01-home-desktop.png)
![Result with timestamps](docs/screenshots/04-result-timestamps.png)

---

## 1. Features (current, v0.1.0)

| Feature | Details |
|---|---|
| Paste any YouTube link | `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…`, `/embed/…`, `/live/…`, `/v/…`, `m.` / `music.` / `youtube-nocookie.com`, attribution links, links without `https://`, or a bare 11-character video ID. Invalid input shows an inline error and never reaches the server. |
| Result page `/transcript?v=VIDEO_ID[&lang=xx]` | Thumbnail (click to play a privacy-mode embed), title, channel, length (when known), a "Transcript" heading and the text in readable paragraphs. |
| Copy transcript | Big button in a sticky toolbar. Copies plain text, or text with `[m:ss]` timestamps when the toggle is on. |
| Timestamps toggle | Adds a clickable `m:ss` to each paragraph. Clicking it plays the video from that point. |
| Language picker | Shown when more than one caption language is known for the video (see the limitations in §9). |
| Downloads | `.txt` (paragraphs), `.srt`, `.vtt` (subtitle cues; overlapping auto-caption cues are clamped), `.json` (full data). Generated in the browser, so there's no extra server call. |
| States | Loading skeleton, empty-captions state, friendly error cards with retry and language suggestions, a "no video yet" page, 404. |
| Mobile | Single-column layout under 640 px, full-width buttons, no horizontal scrolling (checked at 390 px). |
| Privacy | No analytics, no cookies, no ads. The embed loads from `youtube-nocookie.com`, and only after the user presses play. |
| API | `GET /api/transcript?v=&lang=&format=` (see §6). |
| CLI | `npm run transcript -- <url> --format txt\|timestamped\|srt\|vtt\|json` (see §7). |

## 2. Tech stack and dependencies

- **Next.js 16** (App Router, Turbopack build) + **React 19** + **TypeScript 5.9**. Plain CSS (`src/app/globals.css`), with no UI framework.
- Runtime dependencies: `next`, `react`, `react-dom`, `undici` (only used for the optional HTTP proxy).
- Dev dependencies: `vitest` (tests), `eslint` + `eslint-config-next`, `tsx` (runs the CLI), `playwright` (screenshot script only), `@types/*`.
- **No transcript SDK.** The YouTube logic is our own code in `src/lib/fetchers/innertube.ts`.
- External services: YouTube (no key), **Supadata** (paid transcript API, used in production as the fallback), Vercel (hosting).
- Full license inventory: [`DEPENDENCIES.md`](./DEPENDENCIES.md). On 2026-11-21, `npm audit` reported 0 vulnerabilities.

## 3. Run it locally

Requires **Node.js ≥ 20.9** (developed on Node 24) and npm.

```bash
git clone https://github.com/coolcatch/youtube-transcript-tool.git
cd youtube-transcript-tool
npm ci                 # or npm install
cp .env.example .env.local   # optional: every variable is optional locally
npm run dev            # http://localhost:3000
```

On a home or office internet connection, **no keys are needed**. YouTube usually serves captions directly to residential IPs.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` then `npm start` | Production build, then serve it |
| `npm test` | 59 Vitest unit tests (no network) |
| `npm run lint` | ESLint (Next.js rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run transcript -- <url> [opts]` | CLI |
| `npm run screenshots` | Playwright screenshots of a running server (see `scripts/screenshots.ts`) |

Offline / UI work without YouTube: set `TRANSCRIPT_FIXTURE_MODE=1` and open `/transcript?v=fixture0001` (synthetic data in `fixtures/`).

## 4. How transcript extraction works

All fetching is server-side, in `/api/transcript` and the CLI. The browser never talks to YouTube or Supadata, except to show the thumbnail and the embed.

```
request ─► validate v / lang / format ─► in-memory cache? ─► fetcher chain (first success wins)
   1. YouTube direct ("innertube")            free, no key
        a. POST youtube.com/youtubei/v1/player as the ANDROID app → list of caption tracks
        b. if that fails: scrape ytInitialPlayerResponse from the watch page
        c. download the chosen track's timedtext XML → parse into segments
   2. "thirdparty" = Supadata                 only if TRANSCRIPT_FALLBACKS contains "thirdparty" and TRANSCRIPT_API_KEY is set
   3. "whisper" = yt-dlp + speech-to-text     only if enabled + key + yt-dlp installed (not possible on Vercel)
─► JSON TranscriptResult ─► browser groups segments into paragraphs and builds the downloads
```

- **Track choice** (direct path): an exact `lang`, then the base language (`fr-CA` → `fr`), with creator captions preferred over auto-generated ones. With no `lang`: creator English → any English → the first track.
- **Errors that stop the chain** (facts about the video): `INVALID_ID`, `VIDEO_UNAVAILABLE`, `LANG_NOT_FOUND`. Errors that move on to the next fetcher: `NO_CAPTIONS`, `BLOCKED`, `UPSTREAM`.
- **In production on Vercel, step 1 is blocked by YouTube** (datacenter IPs; confirmed Nov 21, 2026). Every uncached request therefore ends up at Supadata. Step 1 still runs first and fails fast.

## 5. Supadata integration (production fallback)

- Code: `src/lib/fetchers/thirdParty.ts`. Call: `GET {TRANSCRIPT_API_BASE_URL}/youtube/transcript?videoId=ID[&lang=xx]` with the header `x-api-key: <TRANSCRIPT_API_KEY>`. The response `content[]` (`text`, `offset` ms, `duration` ms), `lang` and `availableLangs` are mapped to our `TranscriptResult`. The title and channel come from YouTube oEmbed.
- Enabled in Vercel with `TRANSCRIPT_FALLBACKS=thirdparty` and `TRANSCRIPT_API_KEY`. The key exists **only** in Vercel's environment variables, never in git.
- **Plan: Supadata free tier, 100 transcripts per month, no rollover.** Paid plans start at about $5/mo (billed annually) as seen on Nov 21, 2026. Check supadata.ai/pricing.
- **Credit usage:** one credit per uncached (video, language) request. Repeat requests for the same URL are served by Vercel's CDN cache (`s-maxage=3600`, so 1 hour) and the per-instance memory cache (6 hours) without using credits. The CDN cache was confirmed with `x-vercel-cache: HIT`.
- **When credits run out**, Supadata returns an error (HTTP 429/402), every new transcript fails, and users currently see the generic message "YouTube didn't answer properly. Please try again." A clearer "monthly limit reached" message is task #1 in `AI_HANDOFF.md`.

## 6. API

`GET /api/transcript`

| Param | Required | Notes |
|---|---|---|
| `v` | yes | Any supported YouTube URL or video ID |
| `lang` | no | Language code `[A-Za-z0-9-]{2,15}`, e.g. `en`, `fr`, `pt-BR` |
| `format` | no | `txt`, `timestamped`, `srt`, `vtt`, `json`. If omitted, you get the JSON object the UI uses. With it, you get a file download. |

Success: `{ videoId, title, author, lengthSeconds?, thumbnailUrl, language, languageName, isAutoGenerated, tracks[], segments[{start,duration,text}], source, fetchedAt }`.
Errors: `{ "error": { "code", "message", "tracks"? } }`.

| HTTP | code | Meaning |
|---|---|---|
| 400 | `INVALID_ID`, `INVALID_FORMAT`, `INVALID_LANG` | Bad input (rejected before any outside call) |
| 404 | `NO_CAPTIONS`, `VIDEO_UNAVAILABLE`, `LANG_NOT_FOUND` | Video has no captions, is private or removed, or the language doesn't exist |
| 501 | `NOT_CONFIGURED` | A fallback is enabled but its key or tool is missing |
| 502 | `UPSTREAM` | YouTube or Supadata failed. **This includes "Supadata credits exhausted" today.** |
| 503 | `BLOCKED` | YouTube blocked the server and no fallback succeeded |
| 500 | `INTERNAL` | Unexpected error (details only in the server logs) |

Note: the API is public and has no authentication (see `SECURITY_REVIEW.md`).

## 7. CLI

```bash
npm run transcript -- https://youtu.be/Eux-VGsdw8o                      # plain text to stdout
npm run transcript -- https://youtu.be/Eux-VGsdw8o --format srt --out talk.srt
npm run transcript -- Eux-VGsdw8o --format timestamped --lang fr
```
Options: `--format txt|timestamped|srt|vtt|json` (default `txt`), `--lang <code>`, `--out <file>`. Exit code 1 means a fetch error, 2 means bad input. It uses the same code and env vars as the server and reads them from your shell (not from `.env.local`).

## 8. Environment variables

**Every variable is optional for the code to start.** In production on Vercel, the two marked **Required in prod** are needed because YouTube blocks Vercel.
Where they go: **Vercel** = Vercel → Project → Settings → Environment Variables (then redeploy). **Local** = `.env.local` (git-ignored) for `npm run dev`/`start`. **CLI** = exported in your shell before `npm run transcript`.
`.env.example` lists them all with placeholders only. **Never commit real values.**

| Variable | Required? | Default | Where | Purpose |
|---|---|---|---|---|
| `TRANSCRIPT_FALLBACKS` | **Required in prod** (`thirdparty`) | empty (fallbacks off) | Vercel; local/CLI only if testing fallbacks | Comma list of fallbacks tried after YouTube direct fails: `thirdparty`, `whisper`. |
| `TRANSCRIPT_API_KEY` | **Required in prod** (secret) | empty | **Vercel only** (mark it *Sensitive*). Locally only if you deliberately test Supadata, and that uses credits. | Supadata API key. Sent server-side as the `x-api-key` header. |
| `TRANSCRIPT_API_PROVIDER` | optional | `supadata` | Vercel / local | Third-party provider name. Only `supadata` is implemented. |
| `TRANSCRIPT_API_BASE_URL` | optional | `https://api.supadata.ai/v1` | Vercel / local | Override the Supadata base URL (e.g. a mock server for tests). |
| `YT_PROXY_URL` | optional (secret if it has credentials) | empty | Vercel / local / CLI | HTTP(S) proxy for all YouTube requests, e.g. `http://user:pass@host:port`. A residential proxy can make the free direct path work on Vercel again. |
| `YT_REQUEST_TIMEOUT_MS` | optional | `15000` | any | Timeout for each outgoing request. |
| `TRANSCRIPT_CACHE_TTL_SECONDS` | optional | `21600` (6 h) | any | In-memory cache TTL per server instance. `0` turns it off. |
| `TRANSCRIPT_CACHE_MAX_ENTRIES` | optional | `200` | any | Size of the in-memory cache. |
| `WHISPER_API_KEY` | optional (secret) | empty | **CLI / self-hosted only** | Key for an OpenAI-compatible `/audio/transcriptions` API (the `whisper` fallback, for videos with no captions). Doesn't work on Vercel. |
| `WHISPER_API_BASE_URL` | optional | `https://api.openai.com/v1` | CLI / self-hosted | Base URL of that API. |
| `WHISPER_MODEL` | optional | `whisper-1` | CLI / self-hosted | Model name. |
| `YTDLP_PATH` | optional | `yt-dlp` | CLI / self-hosted | Path to the `yt-dlp` binary that downloads audio for the whisper fallback. |
| `TRANSCRIPT_FIXTURE_MODE` | dev only | empty | Local only. **Never set this on Vercel.** | `1` = serve `fixtures/<id>.json` instead of fetching (offline dev, screenshots). |
| `BASE_URL`, `OUT_DIR`, `SHOT_VIDEO`, `CHROME_PATH` | dev only | see script | Shell, for `npm run screenshots` | Screenshot script settings. Not used by the app. |

No variable uses the `NEXT_PUBLIC_` prefix, so none of them are ever sent to the browser.

## 9. Deploy and maintain on Vercel

**Current production:**
- Vercel project `youtube-transcript-tool` in the team `lisas-projects-01adf54e`.
- URL <https://youtube-transcript-tool-flax.vercel.app/>.
- Production branch is **`main`**, connected to GitHub `coolcatch/youtube-transcript-tool`. Every push or merge to `main` deploys to production, and every PR gets a preview deployment, with a link from the Vercel bot in the PR.

**First-time setup (already done, kept for reference):**
1. Go to vercel.com → **Add New → Project → Import** `coolcatch/youtube-transcript-tool`. The framework (Next.js) is auto-detected, with the default build command `npm run build`.
2. Under **Settings → Environment Variables**, add `TRANSCRIPT_FALLBACKS=thirdparty` and `TRANSCRIPT_API_KEY=<Supadata key>`, ticking "Sensitive" for the key.
3. Deploy. Changing an env var **needs a redeploy**: Deployments → ⋯ → Redeploy.

**Routine maintenance:**
- Watch the Supadata dashboard for monthly usage (100 a month on the free plan).
- Check Vercel → Project → **Logs** for errors on `/api/transcript`.
- Check that a deploy succeeded on GitHub: the commit's status shows "Vercel – Deployment has completed". From the CLI: `gh api repos/coolcatch/youtube-transcript-tool/commits/<sha>/status`.
- Keep dependencies current. `npm outdated` and `npm audit` should be run monthly, and any upgrade goes through a PR so a preview is built.

**Rolling back a bad deployment:**
1. **Fastest, no code involved:** Vercel → Project → **Deployments** → pick the last good production deployment → ⋯ → **Instant Rollback** (or **Promote to Production**). Production switches in seconds. Note that auto-deploys from `main` may pause until you promote again.
2. **Through git (permanent):** open a PR that reverts the bad change with `git revert <sha>` (for a merge commit, `git revert -m 1 <merge-sha>`). When it's merged, Vercel deploys the reverted code. **Never force-push `main`.**

## 10. Troubleshooting

| Symptom (UI message / API code) | Likely cause | Fix |
|---|---|---|
| "YouTube didn't answer properly" / `UPSTREAM` with message `Transcript API returned HTTP 429` (or 402) | **Supadata monthly credits used up** | Wait for the monthly reset, upgrade the Supadata plan, or add `YT_PROXY_URL`. Then redeploy. |
| `UPSTREAM` with `HTTP 401/403` from the Transcript API | Supadata key wrong, revoked or missing | Fix `TRANSCRIPT_API_KEY` in Vercel and redeploy. |
| "YouTube is temporarily blocking our server" / `BLOCKED` | The direct path is blocked and the fallback is off or failed | Check that `TRANSCRIPT_FALLBACKS=thirdparty` and the key are set **for the Production environment**, then redeploy. |
| `NOT_CONFIGURED` | A fallback is listed in `TRANSCRIPT_FALLBACKS` without its key, or without yt-dlp for whisper | Add the key, or remove that fallback from the list. |
| "This video doesn't have captions" / `NO_CAPTIONS` | Neither YouTube nor Supadata has captions for the video | Expected. (Whisper fallback, CLI only.) |
| `VIDEO_UNAVAILABLE` | Private, removed, age-restricted, members-only or live video | Expected. |
| `LANG_NOT_FOUND` | That language doesn't exist for the video | The error lists the languages that do exist. |
| Works locally, fails on Vercel | Expected: YouTube blocks datacenter IPs | That's what the Supadata fallback is for. |
| Locally, the direct path suddenly fails for every video | YouTube changed its internal API | Bump `ANDROID_CLIENT.clientVersion` in `src/lib/fetchers/innertube.ts` (see HANDOFF.md §6). |
| An env var change has no effect | Vercel only applies env vars to new deployments | Redeploy. |
| Build fails on Vercel | Check the build log | Run `npm ci && npm run build` locally on Node 20+ and fix any TypeScript or lint errors. |

## 11. Project layout

```
src/app/                     pages (/, /transcript), /api/transcript route, layout, CSS, 404
src/components/              UrlForm.tsx, TranscriptView.tsx (client components)
src/lib/                     parseVideoId, format (txt/srt/vtt/json/paragraphs), xml, cache, config (all env vars), http, types, transcript (chain)
src/lib/fetchers/            innertube (YouTube direct), thirdParty (Supadata), whisper, fixture, oembed
scripts/                     transcript.ts (CLI), screenshots.ts
tests/                       vitest unit tests
fixtures/, public/           synthetic fixture video + thumbnail
docs/screenshots/            README images
```

## License

MIT, see [LICENSE](./LICENSE). Transcripts belong to the video creators. Respect YouTube's Terms of Service and copyright when you reuse them.
