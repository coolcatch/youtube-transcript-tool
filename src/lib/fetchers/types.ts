import type { TranscriptResult } from "../types";

/** A pluggable way to get a transcript. Throw TranscriptError on failure. */
export interface Fetcher {
  name: string;
  fetch(videoId: string, lang?: string): Promise<TranscriptResult>;
}
