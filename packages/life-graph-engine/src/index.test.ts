import { describe, it, expect } from "vitest";
import type { BirthInput } from "@life-graph/types";
import { computeLifeGraph, deriveBase12, scoreYear } from "./index.js";

const tz = "Asia/Bangkok";
const birth = (solarDate: string): BirthInput => ({ solarDate, timezone: tz });

/**
 * Ground truth captured directly from myhora.com/horoscope/life-graph.aspx
 * (base[0..11] indexed by age mod 12). See REVERSE-ENGINEERING.md.
 */
describe("deriveBase12 — matches myhora ground truth", () => {
  // weekday sweep, Aug 1995 (reference month → exact)
  const weekdayCases: [string, number[]][] = [
    ["1995-08-01", [7, 12, 3, 6, 9, 12, 8, 11, 11, 1, 3, 5]], // Tue
    ["1995-08-02", [7, 1, 4, 7, 10, 6, 9, 12, 11, 1, 3, 5]], // Wed
    ["1995-08-03", [7, 2, 5, 8, 4, 7, 10, 1, 11, 1, 3, 5]], // Thu
    ["1995-08-04", [7, 3, 6, 2, 5, 8, 11, 2, 11, 1, 3, 5]], // Fri
    ["1995-08-05", [7, 4, 12, 3, 6, 9, 12, 3, 11, 1, 3, 5]], // Sat
    ["1995-08-06", [7, 10, 1, 4, 7, 10, 1, 4, 11, 1, 3, 5]], // Sun
    ["1995-08-07", [7, 11, 2, 5, 8, 11, 2, 10, 11, 1, 3, 5]], // Mon
  ];
  for (const [date, expected] of weekdayCases) {
    it(`weekday ${date}`, () => {
      expect(deriveBase12(birth(date))).toEqual(expected);
    });
  }

  // month sweep (lunar ΔS within the same zodiac year)
  const monthCases: [string, number[]][] = [
    ["1995-01-03", [11, 4, 7, 10, 1, 4, 12, 3, 3, 5, 7, 9]], // pre-Songkran
    ["1995-04-04", [3, 8, 11, 2, 5, 8, 4, 7, 7, 9, 11, 1]], // post-Songkran
    ["1995-12-05", [11, 4, 7, 10, 1, 4, 12, 3, 3, 5, 7, 9]],
  ];
  for (const [date, expected] of monthCases) {
    it(`month ${date}`, () => {
      expect(deriveBase12(birth(date))).toEqual(expected);
    });
  }

  it("same weekday + same lunar month ⇒ identical (1 & 15 Aug 1995 are both Tue)", () => {
    expect(deriveBase12(birth("1995-08-15"))).toEqual(
      deriveBase12(birth("1995-08-01"))
    );
  });
});

describe("scoreYear — value(age) = base[age mod 12], range 1..12", () => {
  it("is periodic with period 12", () => {
    const b = deriveBase12(birth("1995-08-15"));
    for (let age = 0; age < 90; age++) {
      expect(scoreYear(b, age)).toBe(scoreYear(b, age + 12));
      expect(scoreYear(b, age)).toBeGreaterThanOrEqual(1);
      expect(scoreYear(b, age)).toBeLessThanOrEqual(12);
    }
  });

  it("matches myhora: 15 Aug 1995 at age 31 → 11", () => {
    const b = deriveBase12(birth("1995-08-15"));
    expect(scoreYear(b, 31)).toBe(11); // base[31 % 12 = 7] = 11
  });
});

describe("computeLifeGraph", () => {
  it("produces one 1..12 point per year and finds peaks/troughs", () => {
    const res = computeLifeGraph(birth("1995-08-15"), {
      fromYear: 1995,
      toYear: 2085,
    });
    expect(res.points).toHaveLength(91);
    expect(res.base12).toEqual([7, 12, 3, 6, 9, 12, 8, 11, 11, 1, 3, 5]);
    const years = new Set(res.points.map((p) => p.year));
    for (const y of [...res.peaks, ...res.troughs]) {
      expect(years.has(y)).toBe(true);
    }
  });

  it("rejects an inverted range", () => {
    expect(() =>
      computeLifeGraph(birth("1995-08-15"), { fromYear: 2000, toYear: 1990 })
    ).toThrow();
  });
});
