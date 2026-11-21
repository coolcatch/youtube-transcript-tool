/**
 * CLI: npm run transcript -- <url-or-id> [--format txt|timestamped|srt|vtt|json] [--lang en] [--out file]
 * Uses exactly the same fetcher chain + env vars as the web app.
 */
import { writeFile } from "node:fs/promises";
import { convert, FORMATS, isFormat } from "../src/lib/format";
import { parseVideoId } from "../src/lib/parseVideoId";
import { getTranscript } from "../src/lib/transcript";
import { TranscriptError } from "../src/lib/types";

const USAGE = `Usage: npm run transcript -- <youtube-url-or-id> [--format ${FORMATS.join("|")}] [--lang <code>] [--out <file>]`;

function parseArgs(argv: string[]) {
  const out: { input?: string; format: string; lang?: string; file?: string } = { format: "txt" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format" || a === "-f") out.format = argv[++i];
    else if (a.startsWith("--format=")) out.format = a.slice(9);
    else if (a === "--lang" || a === "-l") out.lang = argv[++i];
    else if (a.startsWith("--lang=")) out.lang = a.slice(7);
    else if (a === "--out" || a === "-o") out.file = argv[++i];
    else if (a.startsWith("--out=")) out.file = a.slice(6);
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (!out.input) out.input = a;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(USAGE);
    process.exit(2);
  }
  if (!isFormat(args.format)) {
    console.error(`Unknown format "${args.format}". ${USAGE}`);
    process.exit(2);
  }
  const id = parseVideoId(args.input);
  if (!id) {
    console.error(`Could not find a YouTube video ID in "${args.input}".`);
    process.exit(2);
  }
  try {
    const result = await getTranscript(id, args.lang);
    const text = convert(result, args.format);
    if (args.file) {
      await writeFile(args.file, text);
      console.error(`Saved ${result.segments.length} cues (${result.languageName}, via ${result.source}) to ${args.file}`);
    } else {
      process.stdout.write(text);
    }
  } catch (e) {
    if (e instanceof TranscriptError) {
      console.error(`Error [${e.code}]: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

main();
