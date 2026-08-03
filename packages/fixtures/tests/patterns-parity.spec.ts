/**
 * P5 gate, part two: 格局 against upstream's `green_dragon` / `fly_bird` /
 * `jade_girl`.
 *
 * Upstream reports absence as the string 沒有 and can also fall off the end of
 * a branch and return `None`; both mean "did not form" and map to `null` here.
 */
import { describe, expect, it } from "vitest";
import { juLabel, patterns, type Method } from "@cka4913/qimen-core";
import { label, loadPatterns, toCivil, upstreamHourIsSound } from "../src/index.js";

const all = loadPatterns();
const cases = all.cases.filter((c) => upstreamHourIsSound(c.input));

/**
 * 格局 are read off the sky plate, which the 陰遁 rotation order feeds, so on
 * 陰遁 charts upstream's answers are not a target — see PORTING-NOTES D10.
 * 陽遁 charts, which D10 leaves untouched, keep the full comparison.
 *
 * The two schools can disagree on 陰/陽 for the same moment, so this is decided
 * per method rather than once per case.
 */
const isYang = (input: Parameters<typeof toCivil>[0], method: Method) =>
  juLabel(toCivil(input), method).startsWith("陽");
const METHODS: Method[] = ["chaibu", "zhirun"];

/** Upstream's `{ 名: 宮 | "沒有" }`, or a missing dict, as a palace or null. */
function upstreamGong(entry: Record<string, string> | null | undefined, key: string): string | null {
  if (!entry) return null;
  const value = entry[key];
  if (value === undefined || value === "沒有") return null;
  return value;
}

describe("patterns corpus", () => {
  it("is non-trivial and upstream never raised on it", () => {
    expect(cases.length).toBeGreaterThan(1_000);
  });
});

for (const method of METHODS) {
  describe(`格局 ${method}`, () => {
    it("青龍返首, 飛鳥跌穴 and 玉女守門 agree with upstream", () => {
      const failures: string[] = [];
      let compared = 0;
      for (const c of cases) {
        if (!isYang(c.input, method)) continue;
        compared++;
        const mine = patterns(toCivil(c.input), method);
        const want = c[method] as Record<string, Record<string, string> | null>;
        const checks: Array<[string, string | null, string | null]> = [
          ["青龍返首", mine.greenDragon.gong, upstreamGong(want["greenDragon"], "青龍返首")],
          ["飛鳥跌穴", mine.flyingBird.gong, upstreamGong(want["flyBird"], "飛鳥跌穴")],
          ["玉女守門", mine.jadeGirl.gong, upstreamGong(want["jadeGirl"], "玉女守門")],
        ];
        for (const [name, got, expected] of checks) {
          if (got !== expected) {
            failures.push(`${label(c.input)} ${name}: got ${got}, want ${expected}`);
          }
        }
      }
      expect(compared, "the 陽遁 half must still be a meaningful sample").toBeGreaterThan(500);
      expect(failures.slice(0, 15)).toEqual([]);
      expect(failures).toHaveLength(0);
    }, 120_000);
  });
}
