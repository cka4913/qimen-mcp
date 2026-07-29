/**
 * P5 gate, part one: 金函玉鏡 against upstream's `gpan()`.
 */
import { describe, expect, it } from "vitest";
import { buildGoldenMirrorChart } from "@kinqimen/core";
import { label, loadGolden, toCivil, upstreamHourIsSound } from "../src/index.js";

const all = loadGolden();
// 金函玉鏡 reads only the day pillar, which the ephem hour bug also shifts on the
// affected dates (23:00 rolls the day over), so the same filter applies.
const cases = all.cases.filter((c) => upstreamHourIsSound(c.input));

describe("golden mirror corpus", () => {
  it("is non-trivial and free of upstream errors", () => {
    expect(cases.length).toBeGreaterThan(1_000);
    expect(all.cases.filter((c) => c.error)).toHaveLength(0);
  });
});

describe("金函玉鏡 matches upstream", () => {
  it("局, 鶴神, 星, 門 and 神 agree on every case", () => {
    const failures: string[] = [];
    for (const c of cases) {
      const chart = buildGoldenMirrorChart(toCivil(c.input));
      const want = c.gpan as Record<string, any>;
      const say = (field: string, got: unknown, expected: unknown) =>
        failures.push(`${label(c.input)} ${field}: got ${JSON.stringify(got)}, want ${JSON.stringify(expected)}`);

      if (chart.ju !== want["局"]) say("局", chart.ju, want["局"]);
      // Upstream's 鶴神 is a repeated-character list or missing entirely.
      const wantCrane = want["鶴神"] ?? null;
      if (JSON.stringify(chart.craneGod) !== JSON.stringify(wantCrane)) say("鶴神", chart.craneGod, wantCrane);

      for (const [key, mine] of [
        ["星", chart.stars],
        ["門", chart.doors],
        ["神", chart.gods],
      ] as const) {
        const expected = want[key] as Record<string, string>;
        for (const k of new Set([...Object.keys(mine), ...Object.keys(expected)])) {
          if (mine[k] !== expected[k]) {
            say(`${key} ${k}`, mine[k], expected[k]);
            break;
          }
        }
      }
    }
    expect(failures.slice(0, 15)).toEqual([]);
    expect(failures).toHaveLength(0);
  }, 120_000);
});
