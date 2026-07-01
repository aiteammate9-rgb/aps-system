import { describe, it, expect } from "vitest";
import {
  toBuddhistYear,
  toGregorianYear,
  parseISODate,
  formatISODate,
  solarToThaiLunar,
  thaiLunarToSolar,
  NotImplementedError,
  weekdayOf,
  isAdhikamasaYear,
  lifeGraphShift,
  zodiacYear,
  thaiLunarMonth,
} from "./index.js";

describe("year conversion", () => {
  it("round-trips BE <-> CE", () => {
    expect(toBuddhistYear(1995)).toBe(2538);
    expect(toGregorianYear(2538)).toBe(1995);
    expect(toGregorianYear(toBuddhistYear(2026))).toBe(2026);
  });
});

describe("ISO date helpers", () => {
  it("parses and formats symmetrically (UTC, timezone-safe)", () => {
    expect(formatISODate(parseISODate("2026-06-26"))).toBe("2026-06-26");
  });

  it("rejects malformed input", () => {
    expect(() => parseISODate("26/06/2026")).toThrow();
  });
});

describe("weekdayOf", () => {
  it("0=Sun..6=Sat, verified dates", () => {
    expect(weekdayOf(1995, 8, 1)).toBe(2); // Tuesday
    expect(weekdayOf(1995, 8, 15)).toBe(2); // Tuesday (same → same chart)
    expect(weekdayOf(2026, 6, 26)).toBe(5); // Friday
  });
});

describe("isAdhikamasaYear (leap-month / เดือน 8 สองหน)", () => {
  it("flags known leap-month CS years", () => {
    // 2015 CE → CS 1377 is an adhikamasa year
    expect(isAdhikamasaYear(2015 - 638)).toBe(true);
    expect(isAdhikamasaYear(2016 - 638)).toBe(false);
  });
});

describe("zodiacYear", () => {
  it("rolls over at Songkran (~April)", () => {
    expect(zodiacYear(1995, 3)).toBe(1994); // pre-Songkran
    expect(zodiacYear(1995, 4)).toBe(1995); // post-Songkran
  });
});

describe("lifeGraphShift", () => {
  it("advances +1 per lunar month within a year (relative)", () => {
    const aug = lifeGraphShift(1995, 8, 1);
    const sep = lifeGraphShift(1995, 9, 1);
    expect(((sep - aug) % 12 + 12) % 12).toBe(1);
  });
});

describe("thaiLunarMonth (full สุริยยาตร์ port)", () => {
  it("matches myhora ground truth", () => {
    expect(thaiLunarMonth(1959, 6, 25)).toBe(7); // เดือนเจ็ด
    expect(thaiLunarMonth(1995, 8, 15)).toBe(9); // เดือนเก้า
    expect(thaiLunarMonth(2026, 6, 26)).toBe(8); // เดือนแปด (วันจร, ตรง myhora)
  });
});

describe("lunar conversion (placeholder)", () => {
  it("throws NotImplementedError until P1 algorithm lands", () => {
    expect(() => solarToThaiLunar("2026-06-26")).toThrow(NotImplementedError);
    expect(() =>
      thaiLunarToSolar({ year: 2569, month: 8, waxWane: "wax", day: 15 })
    ).toThrow(NotImplementedError);
  });
});
