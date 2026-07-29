/**
 * P2 gate: 排局 must match upstream for both schools.
 *
 * The 置閏 ladder is the most special-cased code in the engine, so the corpus
 * leans hard on its edges: every solar-term boundary at 20-minute resolution,
 * and the whole 芒種→夏至 and 大雪→冬至 置閏 windows day by day.
 */
import { describe, expect, it } from "vitest";
import { juChaibu, juKe, juZhirun, zhirunRaw } from "@kinqimen/core";
import { label, loadJu, toCivil, upstreamHourIsSound } from "../src/index.js";

const all = loadJu();
const cases = all.cases.filter((c) => upstreamHourIsSound(c.input));

function check(name: string, got: (i: (typeof cases)[number]) => string, want: (i: (typeof cases)[number]) => string) {
  it(name, () => {
    const failures: string[] = [];
    for (const c of cases) {
      const g = got(c);
      const w = want(c);
      if (g !== w) failures.push(`${label(c.input)}: got ${g}, want ${w}`);
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
}

describe("ju corpus", () => {
  it("is non-trivial and free of upstream errors", () => {
    expect(cases.length).toBeGreaterThan(5_000);
    expect(all.cases.filter((c) => c.error)).toHaveLength(0);
  });
});

describe("排局 matches upstream", () => {
  check("拆補法", (c) => juChaibu(toCivil(c.input)), (c) => c.chaibu);
  check("置閏法", (c) => juZhirun(toCivil(c.input)), (c) => c.zhirun);
  check("刻家", (c) => juKe(toCivil(c.input)), (c) => c.ke);
});

describe("置閏 intermediates match upstream", () => {
  it("every field the ladder reads agrees on every case", () => {
    const failures: string[] = [];
    for (const c of cases) {
      const got = zhirunRaw(toCivil(c.input));
      const want = c.raw;
      for (const key of Object.keys(want) as Array<keyof typeof want>) {
        if (got[key] !== want[key]) {
          failures.push(`${label(c.input)} ${key}: got ${got[key]}, want ${want[key]}`);
          break;
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});
