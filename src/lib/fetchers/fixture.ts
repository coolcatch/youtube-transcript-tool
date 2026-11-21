import { readFile } from "node:fs/promises";
import path from "node:path";
import { TranscriptError, type TranscriptResult } from "../types";
import type { Fetcher } from "./types";

/**
 * Test/demo fetcher. When TRANSCRIPT_FIXTURE_MODE=1, serves fixtures/<videoId>.json
 * instead of calling YouTube. Used for screenshots and offline development.
 */
export const fixtureFetcher: Fetcher = {
  name: "fixture",
  async fetch(videoId) {
    try {
      const raw = await readFile(path.join(process.cwd(), "fixtures", `${videoId}.json`), "utf8");
      return { ...(JSON.parse(raw) as TranscriptResult), source: "fixture" };
    } catch {
      throw new TranscriptError("NO_CAPTIONS", `No fixture for ${videoId} (fixture mode is on).`);
    }
  },
};
