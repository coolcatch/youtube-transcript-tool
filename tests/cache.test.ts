import { describe, expect, it } from "vitest";
import { TtlCache } from "@/lib/cache";

describe("TtlCache", () => {
  it("expires entries", () => {
    let now = 0;
    const c = new TtlCache<number>(1000, 10, () => now);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    now = 1001;
    expect(c.get("a")).toBeUndefined();
  });
  it("evicts oldest beyond max", () => {
    const c = new TtlCache<number>(1000, 2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    expect(c.get("a")).toBeUndefined();
    expect(c.size).toBe(2);
  });
  it("disabled when ttl is 0", () => {
    const c = new TtlCache<number>(0, 10);
    c.set("a", 1);
    expect(c.get("a")).toBeUndefined();
  });
});
