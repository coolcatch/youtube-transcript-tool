import { describe, expect, it } from "vitest";
import { isValidVideoId, parseVideoId } from "@/lib/parseVideoId";

const ID = "Eux-VGsdw8o";

describe("parseVideoId", () => {
  it.each([
    [ID],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s`],
    [`https://www.youtube.com/watch?feature=share&v=${ID}`],
    [`http://m.youtube.com/watch?v=${ID}`],
    [`https://music.youtube.com/watch?v=${ID}&list=RD123`],
    [`www.youtube.com/watch?v=${ID}`],
    [`youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abc123&t=10`],
    [`youtu.be/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://youtube.com/shorts/${ID}?feature=share`],
    [`https://www.youtube.com/embed/${ID}?start=5`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}`],
    [`https://www.youtube.com/v/${ID}`],
    [`https://www.youtube.com/attribution_link?u=/watch%3Fv%3D${ID}%26feature%3Dshare`],
    [`https://youtubetotranscript.com/transcript?v=${ID}`.replace("youtubetotranscript.com/transcript", "www.youtube.com/watch")],
    [`  https://youtu.be/${ID}  `],
  ])("extracts the ID from %s", (input) => {
    expect(parseVideoId(input)).toBe(ID);
  });

  it.each([
    [""],
    ["hello world"],
    ["https://vimeo.com/123456"],
    ["https://www.youtube.com/"],
    ["https://www.youtube.com/watch?v=short"],
    ["https://www.youtube.com/channel/UC1234567890"],
    ["https://evil.com/watch?v=Eux-VGsdw8o"],
    ["https://youtu.be/"],
    ["Eux-VGsdw8o1"],
  ])("rejects %s", (input) => {
    expect(parseVideoId(input)).toBeNull();
  });

  it("validates bare ids", () => {
    expect(isValidVideoId(ID)).toBe(true);
    expect(isValidVideoId("abc")).toBe(false);
    expect(isValidVideoId("abc def ghij")).toBe(false);
  });
});
