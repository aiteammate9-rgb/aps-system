import { describe, it, expect } from "vitest";
import { tierFromScore, interpretYear } from "./index.js";

describe("tierFromScore (เลข 1..12)", () => {
  it("maps the 1..12 scale", () => {
    expect(tierFromScore(12)).toBe("excellent");
    expect(tierFromScore(11)).toBe("excellent");
    expect(tierFromScore(10)).toBe("good");
    expect(tierFromScore(9)).toBe("good");
    expect(tierFromScore(8)).toBe("neutral");
    expect(tierFromScore(6)).toBe("neutral");
    expect(tierFromScore(5)).toBe("caution");
    expect(tierFromScore(3)).toBe("difficult");
    expect(tierFromScore(1)).toBe("difficult");
  });
});

describe("interpretYear", () => {
  it("carries through year/age and emits a headline", () => {
    const r = interpretYear({ year: 2030, age: 35, score: 12 });
    expect(r.year).toBe(2030);
    expect(r.tier).toBe("excellent");
    expect(r.headline.length).toBeGreaterThan(0);
  });
});
