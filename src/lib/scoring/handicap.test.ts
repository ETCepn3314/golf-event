import { describe, expect, it } from "vitest";
import { strokesReceived } from "./handicap";

describe("strokesReceived", () => {
  it("gives no strokes at handicap 0", () => {
    for (let si = 1; si <= 18; si++) {
      expect(strokesReceived(0, si)).toBe(0);
    }
  });

  it("gives strokes only on SI 1-9 at handicap 9", () => {
    expect(strokesReceived(9, 9)).toBe(1);
    expect(strokesReceived(9, 10)).toBe(0);
    expect(strokesReceived(9, 1)).toBe(1);
  });

  it("gives one stroke everywhere at handicap 18", () => {
    for (let si = 1; si <= 18; si++) {
      expect(strokesReceived(18, si)).toBe(1);
    }
  });

  it("gives a second stroke on SI 1-4 at handicap 22", () => {
    expect(strokesReceived(22, 4)).toBe(2);
    expect(strokesReceived(22, 5)).toBe(1);
    expect(strokesReceived(22, 18)).toBe(1);
  });

  it("applies allowance percentage with rounding before allocation", () => {
    // 90% of 10 = 9 -> strokes on SI 1-9 only
    expect(strokesReceived(10, 9, 90)).toBe(1);
    expect(strokesReceived(10, 10, 90)).toBe(0);
    // 90% of 17 = 15.3 -> rounds to 15
    expect(strokesReceived(17, 15, 90)).toBe(1);
    expect(strokesReceived(17, 16, 90)).toBe(0);
  });

  it("returns 0 when the hole has no stroke index", () => {
    expect(strokesReceived(18, null)).toBe(0);
    expect(strokesReceived(18, undefined)).toBe(0);
  });
});
