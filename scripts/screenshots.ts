/**
 * Screenshot helper (dev only). Start the app first, e.g.
 *   TRANSCRIPT_FIXTURE_MODE=1 npm run build && TRANSCRIPT_FIXTURE_MODE=1 npm start
 * then: BASE_URL=http://localhost:3000 OUT_DIR=./screenshots npm run screenshots
 * Uses Playwright with system Chrome if CHROME_PATH is set, else Playwright's Chromium
 * (`npx playwright install chromium`).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? "screenshots";
const VIDEO = process.env.SHOT_VIDEO ?? "fixture0001";

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const shot = (name: string) => path.join(OUT, name);

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desktop.goto(BASE);
  await desktop.screenshot({ path: shot("01-home-desktop.png"), fullPage: true });

  await desktop.fill("#yt-url", "not a youtube link");
  await desktop.click("text=Get transcript");
  await desktop.waitForSelector(".form-error");
  await desktop.screenshot({ path: shot("02-home-invalid-url.png") });

  await desktop.fill("#yt-url", `https://youtu.be/${VIDEO}`);
  await desktop.click("text=Get transcript");
  await desktop.waitForSelector(".transcript p", { timeout: 30000 });
  await desktop.screenshot({ path: shot("03-result-desktop.png"), fullPage: true });

  await desktop.click("label.toggle");
  await desktop.waitForSelector(".transcript .ts");
  await desktop.screenshot({ path: shot("04-result-timestamps.png"), fullPage: true });

  await desktop.goto(`${BASE}/transcript?v=zzzzzzzzzzz`);
  await desktop.waitForSelector(".state-card.error", { timeout: 30000 });
  await desktop.screenshot({ path: shot("05-error-state.png") });

  await desktop.goto(`${BASE}/transcript`);
  await desktop.screenshot({ path: shot("06-empty-state.png") });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mobile.goto(BASE);
  await mobile.screenshot({ path: shot("07-home-mobile.png") });
  await mobile.goto(`${BASE}/transcript?v=${VIDEO}`);
  await mobile.waitForSelector(".transcript p", { timeout: 30000 });
  await mobile.screenshot({ path: shot("08-result-mobile.png") });

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
