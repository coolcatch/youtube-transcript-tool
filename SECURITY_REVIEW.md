# Security review: YouTube Transcript Tool

- **Date:** 2026-11-21, 12:10–12:30 EST (America/Toronto). **Reviewer:** Grok Bot (AI assistant), for Lisa Villary.
- **Scope:** repo `coolcatch/youtube-transcript-tool` at `main` = `94475d5` (plus the docs-only branch `docs/deploy-status`), and the live deployment <https://youtube-transcript-tool-flax.vercel.app/>.
- **Method:** source review, a full-history secret scan, inspection of the live client JavaScript, live error-path requests (none of which used Supadata), and 2 live transcript fetches that did use Supadata credits.
- **Not covered:** Vercel and Supadata account settings (no dashboard access), and penetration testing beyond what's listed here.

## Summary

| # | Area | Result |
|---|---|---|
| 1 | Supadata key server-side only | ✅ Pass |
| 2 | Keys in frontend JavaScript | ✅ Pass (none found) |
| 3 | Secrets in git history | ✅ Pass (gitleaks + manual pattern scan: no findings) |
| 4 | Abuse of public endpoint to burn credits | ❌ **High risk, open.** Needs a fix (see F1–F3). |
| 5 | Input validation | ✅ Pass |
| 6 | Error handling | ⚠️ Mostly safe. Quota errors are misleading (F4), and some low-risk detail leaks (F6). |

**No API key is known to be exposed.** No code changes were made during this review. Every fix below is a **proposal for Lisa to approve**.

## Checks performed and evidence

### 1. Supadata credentials stay server-side ✅
- The key is read only in `src/lib/config.ts` (`process.env.TRANSCRIPT_API_KEY`) and used only in `src/lib/fetchers/thirdParty.ts`, which runs only inside the Node.js route `src/app/api/transcript/route.ts` (`runtime = "nodejs"`) and the CLI.
- The client components (`src/components/*.tsx`, marked `"use client"`) import only `parseVideoId`, `format` and `types`, never `config`, `http` or `fetchers`.
- **There are no `NEXT_PUBLIC_` variables** anywhere in the code (`rg "NEXT_PUBLIC_|process\.env" src scripts`). Next.js only inlines `NEXT_PUBLIC_*` into browser bundles.
- The key is sent to Supadata as the `x-api-key` header, and only over HTTPS (`https://api.supadata.ai/v1` by default).
- The key never appears in responses or logs: error messages contain only HTTP status codes, and `console.error` logs only unexpected exceptions, not request headers.

### 2. No keys in the frontend ✅
- I downloaded all 9 JavaScript chunks the live site serves (from `/` and `/transcript?...`) and searched them for `TRANSCRIPT_API_KEY|supadata|x-api-key|WHISPER_API_KEY|YT_PROXY_URL|NEXT_PUBLIC_|sd_…|sk-…|Bearer`. **0 hits.**
- The same search on the local production build (`.next/static`) also had 0 hits.

### 3. No secrets in git history ✅
- **gitleaks v8.30.1:** `gitleaks git --log-opts="--all"` → "no leaks found" (all branches and commits as of 12:08 EST).
- **Manual scan** of `git log --all -p` for Supadata (`sd_…`), OpenAI (`sk-…`), xAI (`xai-…`), GitHub (`gh[pousr]_…`), AWS (`AKIA…`), private-key headers and `KEY=value` assignments: **0 hits**.
- The only env file ever committed is `.env.example`, which holds empty placeholders. `.gitignore` covers `.env`, `.env*.local` and `.vercel`.
- Documentation and logs (README, HANDOFF, AI_HANDOFF, the Drive copies, the work logs) contain variable **names** only, never values.

### 4. Credit-exhaustion abuse ❌ (main open risk)
- `/api/transcript` is **public with no authentication and no rate limiting**. Every uncached `(video, lang)` combination costs **1 Supadata credit**, and the free plan has 100 a month. A trivial script looping over video IDs or `lang` values could **use up the month's credits in seconds**. After that, the tool fails for everyone until the reset.
- What helps today:
  - Vercel CDN caching of successful responses (`s-maxage=3600`; confirmed `x-vercel-cache: HIT` on a repeat request, and that request used no credit).
  - The in-memory cache (6 hours, per instance).
  - Strict input validation, so junk never reaches Supadata.
- What doesn't help: the cache key includes the raw query string, so `v=<full URL>`, `v=<id>` and any `format=` variant are separate cache entries. Each of them can miss the CDN cache and spend a credit, unless the in-memory cache on that same instance catches it.

### 5. Input validation ✅
- `v` must parse to `^[A-Za-z0-9_-]{11}$` (`parseVideoId`), and only YouTube hostnames are accepted. `lang` must match `^[A-Za-z0-9-]{2,15}$`. `format` must be on a whitelist. Anything else gets a 400 **before** any outside call. The live site confirmed this: `v=notavideo` → 400 `INVALID_ID`, `format=docx` → 400 `INVALID_FORMAT`, `lang=../../x` → 400 `INVALID_LANG`.
- **No SSRF:** the outgoing URLs are fixed YouTube and Supadata hosts. User input only adds the validated ID and lang, through `URLSearchParams` or a validated path. The proxy and base URLs come from env vars only.
- **No XSS:** transcript text and titles are rendered as React text nodes, with no `dangerouslySetInnerHTML`. Download filenames are sanitised (`fileName()` strips everything except word characters and `-`).
- XML parsing is regex-based (no XML entity expansion, so no XXE).

### 6. Error handling ⚠️
- Unexpected exceptions return a generic 500 `INTERNAL`, and the detail goes only to the server log. Known errors return a code plus a short message.
- Error responses are sent with `Cache-Control: no-store`, so failures aren't cached.

## Findings and proposed fixes (none applied; each needs Lisa's approval)

| ID | Priority | Finding | Proposed fix | Breaking? |
|---|---|---|---|---|
| **F1** | **High** | Public, unauthenticated API with no rate limit lets anyone burn the 100/month Supadata credits | **(a) No code:** add a Vercel Firewall rate-limit rule (Vercel → Project → Firewall → Custom Rule, e.g. path `/api/transcript`, ~10 requests/min per IP → deny/429). Check what Lisa's plan allows. **(b) Code:** a per-IP limit in the route with Upstash Redis / Vercel KV (e.g. 5 new transcripts per IP per day) that counts only Supadata calls. | (a) no; (b) adds a dependency and env vars, non-breaking |
| **F2** | High | No global spending cap: credits can run out early in the month | A monthly counter in KV that stops calling Supadata at e.g. 90/100 and returns `QUOTA_EXCEEDED`. Alternatively, Supadata's own usage alerts, if available. | Non-breaking |
| **F3** | Medium | Cache keys vary by `v` format and `format` param, causing avoidable credit use | Normalise in the route: redirect (308) `/api/transcript?v=<url>` to `?v=<id>`. Raise `s-maxage` to 86400 (24 h) with `stale-while-revalidate`. | Non-breaking (responses are identical, just cached longer) |
| **F4** | Medium | When Supadata quota runs out (HTTP 429/402), users see "YouTube didn't answer properly. Please try again." (`UPSTREAM`), which is misleading and invites retries. Reproduced locally against a mock Supadata returning 429. | Add a `QUOTA_EXCEEDED` error code (HTTP 429) in `thirdParty.ts`, `types.ts` and `TranscriptView.tsx`: "This free tool has reached its monthly transcript limit. Please try again next month." Make `getTranscript()` prefer it over `BLOCKED`, and add unit tests. | Non-breaking (new code path) |
| F5 | Medium | Previews may have the key: if `TRANSCRIPT_API_KEY` is also scoped to **Preview**, every PR preview URL is a second credit-spending endpoint | In Vercel env settings, scope the key to **Production** only, or keep Vercel Deployment Protection on for previews. Couldn't be verified without dashboard access. | No code |
| F6 | Low | `UPSTREAM` messages reveal minor internals (e.g. "Transcript API returned HTTP 429", "fetch failed") | Map to generic client messages, keeping detail only in server logs. The UI already shows friendly text by code. | Non-breaking |
| F7 | Low | No Content-Security-Policy, X-Frame-Options or Permissions-Policy headers | Add them in `next.config.ts` `headers()`: `frame-ancestors 'none'`, `img-src 'self' https://i.ytimg.com`, `frame-src https://www.youtube-nocookie.com`. Test carefully because Next inline scripts need `'unsafe-inline'` or nonces. | Could break the page if done wrong, so test on a preview |
| F8 | Low | Optional bot protection | If abuse is seen, put Cloudflare Turnstile (free) in front of "Get transcript". This adds friction, so it's for later. | Changes UX |
| F9 | Info | Secret hygiene | Mark `TRANSCRIPT_API_KEY` as **Sensitive** in Vercel, rotate the key if it's ever pasted into a chat or doc, and never set `TRANSCRIPT_FIXTURE_MODE` in production. The GitHub token used by the build machine is the machine's own `gh` login and isn't stored in the repo. | No code |

**Suggested order:** F1(a), F5 and F9 (dashboard only, today) → F4 → F3 → F1(b)/F2 → F6 → F7.
