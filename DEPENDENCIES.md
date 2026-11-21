# Dependency & license inventory

Generated 2026-11-21 from `node_modules` (Node 24.x, npm 11.x). Re-check with `npm ls` / `npm audit` after upgrades.
`npm audit` on 2026-11-21: **0 vulnerabilities**.

## Direct dependencies

| Package | Version | Type | License | Why |
|---|---|---|---|---|
| next | 16.4.6 | runtime | MIT | App Router framework, API route, Vercel target |
| react | 19.3.1 | runtime | MIT | UI |
| react-dom | 19.3.1 | runtime | MIT | UI |
| undici | 8.13.1 | runtime | MIT | `ProxyAgent` for the optional `YT_PROXY_URL` (loaded only when set) |
| typescript | 5.9.3 | dev | Apache-2.0 | Types |
| eslint | 9.39.5 | dev | MIT | Lint |
| eslint-config-next | 16.4.6 | dev | MIT | Next.js lint rules |
| vitest | 5.1.1 | dev | MIT | Unit tests |
| tsx | 4.23.15 | dev | MIT | Runs the TypeScript CLI (`npm run transcript`) |
| playwright | 1.65.1 | dev | Apache-2.0 | Screenshot script only (`npm run screenshots`) |
| @types/node, @types/react, @types/react-dom | 26.6.6 / 19.3.0 / 19.3.0 | dev | MIT | Type definitions |

No transcript SDK is used: YouTube fetching is ~200 lines of our own code in `src/lib/fetchers/innertube.ts` (fewer moving parts, easy to patch when YouTube changes).

## Transitive licenses (all installed packages, incl. dev)

| License | Count |
|---|---|
| MIT | 317 |
| Apache-2.0 | 26 |
| ISC | 18 |
| BSD-2-Clause | 7 |
| MPL-2.0 | 3 (`lightningcss`, used by Next's CSS build only) |
| BSD-3-Clause | 2 |
| BlueOak-1.0.0 | 2 |
| LGPL-3.0-or-later | 1 (`@img/sharp-libvips-*`, optional native image lib pulled in by Next; dynamically linked, not modified) |
| CC-BY-4.0 | 1 (`caniuse-lite` data) |
| Python-2.0 | 1 (`argparse`, dev tooling) |
| CC0-1.0 | 1 |
| 0BSD | 1 |

All are permissive or weak-copyleft used unmodified; nothing conflicts with releasing this app under MIT.

## External services

| Service | When | Cost / terms |
|---|---|---|
| YouTube (InnerTube player API, timedtext, oEmbed, watch page) | Always (primary) | Free, unofficial, no key. Subject to YouTube's Terms; may block datacenter IPs. |
| Supadata transcript API | Only if `TRANSCRIPT_FALLBACKS` includes `thirdparty` and a key is set | Paid, see supadata.ai |
| OpenAI-compatible `/audio/transcriptions` (e.g. OpenAI Whisper) | Only if `TRANSCRIPT_FALLBACKS` includes `whisper` and a key is set | Paid per audio minute |
| yt-dlp (binary, Unlicense) | Whisper fallback only, must be installed separately | Free |
