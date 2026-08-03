/**
 * 找局 has no upstream corpus — `kinqimen` has no search feature at all — so it
 * is tested against the rule directly, plus against the semantics established
 * empirically in `test-case/FINDINGS.md`.
 *
 * The reference implementation those findings came from (奇門實用版 v7.88)
 * builds 陰遁 charts differently from this engine, so its *hit lists* are not a
 * target. What is reproduced here is its *semantics*: per-palace AND, and the
 * counting identity that follows from every chart carrying all eight gates.
 */
import { describe, expect, it } from "vitest";
import {
  EIGHT_GUA,
  buildChart,
  findChartTimes,
  panDoor,
  panSky,
  type SearchCriteria,
} from "../src/index.js";

const CHAIBU = "chaibu" as const;
const DAY = { year: 2026, month: 8, day: 3 };
/** One day, so the scan covers exactly the twelve 時辰 of that day. */
const ONE_DAY = { start: DAY, end: DAY, method: CHAIBU, limit: 200 };

function search(criteria: SearchCriteria, opts: Partial<typeof ONE_DAY> = {}) {
  return findChartTimes(criteria, { ...ONE_DAY, ...opts });
}

describe("matching is per-palace, not per-chart", () => {
  it("a bare gate condition matches every 時辰, because every chart has all eight gates", () => {
    const r = search({ doors: ["生"] });
    expect(r.returned).toBe(12);
    expect(new Set(r.matches.map((m) => m.branch)).size).toBe(12);
  });

  it("every chart carries all eight gates and all eight gods", () => {
    for (const hour of [0, 5, 11, 17, 21]) {
      const c = buildChart({ ...DAY, hour, minute: 0 }, CHAIBU);
      expect(new Set(Object.values(c.doors)).size).toBe(8);
      expect(new Set(Object.values(c.gods)).size).toBe(8);
    }
  });

  it("adding a sky-stem condition narrows to the palaces where both sit together", () => {
    const both = search({ doors: ["生"], skyStems: ["丙"] });
    for (const m of both.matches) {
      expect(panDoor(m.datetime, CHAIBU)[m.palace]).toBe("生");
      expect(panSky(m.datetime, CHAIBU)[m.palace]).toBe("丙");
      expect(m.matched.door).toBe("生");
      expect(m.matched.skyStem).toBe("丙");
    }
    expect(both.returned).toBeLessThan(12);
  });

  it("the co-located count is not the intersection of the independent counts", () => {
    // The identity that distinguishes the two semantics. Under per-chart
    // matching `both` would be 12; under per-palace it is far smaller.
    const doorOnly = search({ doors: ["生"] }).returned;
    const skyOnly = search({ skyStems: ["丙"] }).returned;
    const both = search({ doors: ["生"], skyStems: ["丙"] }).returned;
    expect(doorOnly).toBe(12);
    expect(skyOnly).toBe(12);
    expect(both).toBeLessThan(Math.min(doorOnly, skyOnly));
  });
});

describe("palace scoping", () => {
  it("restricting palaces only ever removes hits", () => {
    const all = search({ doors: ["生"] }).matches;
    const scoped = search({ doors: ["生"], palaces: ["艮", "震"] }).matches;
    expect(scoped.length).toBeLessThanOrEqual(all.length);
    for (const m of scoped) expect(["艮", "震"]).toContain(m.palace);
  });

  it("every hit names a real palace and reports what matched there", () => {
    for (const m of search({ doors: ["開"] }).matches) {
      expect(EIGHT_GUA).toContain(m.palace);
      expect(m.matched.door).toBe("開");
      expect(m.dayPillar).toHaveLength(2);
      expect(m.hourPillar).toHaveLength(2);
    }
  });
});

describe("格局 is a palace-level condition", () => {
  it("a pattern hit names the palace the pattern formed in", () => {
    const r = findChartTimes(
      { patterns: ["greenDragon"] },
      { start: { year: 2026, month: 8, day: 1 }, method: CHAIBU, limit: 5, maxDays: 60 }
    );
    expect(r.returned).toBeGreaterThan(0);
    for (const m of r.matches) {
      const chart = buildChart(m.datetime, CHAIBU);
      expect(chart.skyPlate[m.palace]).toBe("戊");
      expect(chart.earthPlate[m.palace]).toBe("丙");
      expect(m.matched.patterns).toEqual(["greenDragon"]);
    }
  });

  it("combining a pattern with a gate keeps them in the same palace", () => {
    const r = findChartTimes(
      { patterns: ["greenDragon"], doors: ["生"] },
      { start: { year: 2026, month: 1, day: 1 }, method: CHAIBU, limit: 5, maxDays: 400 }
    );
    expect(r.returned).toBeGreaterThan(0);
    for (const m of r.matches) {
      expect(panDoor(m.datetime, CHAIBU)[m.palace]).toBe("生");
    }
  });

  it("two patterns that cannot share a palace yield nothing", () => {
    // 青龍返首 is 戊 over 丙; 飛鳥跌穴 is 丙 over 戊. One palace cannot be both.
    const r = findChartTimes(
      { patterns: ["greenDragon", "flyingBird"] },
      { start: { year: 2026, month: 1, day: 1 }, method: CHAIBU, limit: 5, maxDays: 400 }
    );
    expect(r.returned).toBe(0);
  });
});

describe("stopping and resuming", () => {
  it("stops at the limit and says so", () => {
    const r = findChartTimes({ doors: ["生"] }, { start: DAY, method: CHAIBU, limit: 3 });
    expect(r.returned).toBe(3);
    expect(r.limitReached).toBe(true);
    expect(r.budgetExhausted).toBe(false);
  });

  it("reports budget exhaustion rather than pretending to be finished", () => {
    const r = findChartTimes(
      { doors: ["生"], skyStems: ["丙"], earthStems: ["丙"], stars: ["蓬"], gods: ["符"] },
      { start: DAY, method: CHAIBU, limit: 200, maxDays: 3 }
    );
    expect(r.limitReached).toBe(false);
    expect(r.budgetExhausted).toBe(true);
    expect(r.scannedShichen).toBe(36);
  });

  it("the cursor moves forward so a follow-up call makes progress", () => {
    const criteria: SearchCriteria = { doors: ["生"] };
    const first = findChartTimes(criteria, { start: DAY, method: CHAIBU, limit: 5, maxDays: 30 });
    const second = findChartTimes(criteria, {
      start: first.scannedThrough,
      method: CHAIBU,
      limit: 5,
      maxDays: 30,
    });
    expect(first.returned).toBe(5);
    expect(second.returned).toBe(5);
    expect(second.matches[0]!.datetime.day).toBeGreaterThanOrEqual(first.scannedThrough.day);
  });

  it("searches backward into the past", () => {
    const r = findChartTimes(
      { doors: ["生"] },
      { start: DAY, direction: "backward", method: CHAIBU, limit: 5, maxDays: 10 }
    );
    expect(r.returned).toBe(5);
    const days = r.matches.map((m) => m.datetime.day);
    expect(Math.max(...days)).toBeLessThanOrEqual(DAY.day);
  });
});

describe("refuses queries that cannot match", () => {
  it("中宮 with a gate condition", () => {
    expect(() => search({ palaces: ["中"], doors: ["生"] })).toThrowError(/中宮/);
  });

  it("an unknown palace", () => {
    expect(() => search({ palaces: ["乾坤"] })).toThrowError(/nine palaces/);
  });

  it("an end that lies the wrong side of start", () => {
    expect(() =>
      findChartTimes({ doors: ["生"] }, { start: DAY, end: { year: 2020, month: 1, day: 1 }, method: CHAIBU })
    ).toThrowError(/end must be/);
  });
});
