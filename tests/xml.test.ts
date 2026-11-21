import { describe, expect, it } from "vitest";
import { decodeEntities, parseTimedText } from "@/lib/xml";

describe("decodeEntities", () => {
  it("decodes named, numeric and double-encoded entities", () => {
    expect(decodeEntities("I&amp;#39;m &quot;ok&quot; &lt;3 &#x1F600;")).toBe("I'm \"ok\" <3 😀");
    expect(decodeEntities("Tom &amp;amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });
});

describe("parseTimedText", () => {
  it("parses format 1", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?><transcript><text start="0.1" dur="4.1">So, I&amp;#39;m in\nmy 30s</text><text start="2.2" dur="4"></text><text start="4.2" dur="4">[Music]</text></transcript>`;
    expect(parseTimedText(xml)).toEqual([
      { start: 0.1, duration: 4.1, text: "So, I'm in my 30s" },
      { start: 4.2, duration: 4, text: "[Music]" },
    ]);
  });
  it("parses format 3 (srv3) with word spans", () => {
    const xml = `<timedtext format="3"><body><p t="100" d="4100" w="1"><s>So,</s><s t="300"> I&#39;m</s></p><p t="2190" d="2010" w="1" a="1">\n</p></body></timedtext>`;
    expect(parseTimedText(xml)).toEqual([{ start: 0.1, duration: 4.1, text: "So, I'm" }]);
  });
  it("returns [] for garbage", () => {
    expect(parseTimedText("")).toEqual([]);
    expect(parseTimedText("<html>nope</html>")).toEqual([]);
  });
});
