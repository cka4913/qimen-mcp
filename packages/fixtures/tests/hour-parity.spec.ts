/**
 * P3 gate: the whole 時家 chart, field by field, against upstream's `pan()`.
 *
 * Upstream returns one Chinese-keyed dict; this port returns a typed chart with
 * English field names and a couple of shapes flattened. The mapping between the
 * two is written out here rather than in the engine, so the engine never carries
 * upstream's shape around and the translation stays auditable.
 *
 * Each chart is built once and every field checked against it, rather than once
 * per field: a full chart is not cheap, and the corpus is four thousand of them
 * in two schools.
 */
import { describe, expect, it } from "vitest";
import { buildChart, type Method, type QimenChart } from "@cka4913/qimen-core";
import { label, loadHour, toCivil, upstreamHourIsSound, type ChartCase } from "../src/index.js";

const all = loadHour();
const cases = all.cases.filter((c) => upstreamHourIsSound(c.input));
const METHODS: Method[] = ["chaibu", "zhirun"];

type Upstream = Record<string, any>;

/**
 * Layers that the 陰遁 rotation order feeds. Upstream walks 陰遁 in a
 * non-standard order (see PORTING-NOTES D10), so on 陰遁 charts its output for
 * these is not a target — deviations.spec.ts D10 checks them against a
 * reference implementation instead. Everything else, the whole earth plate
 * included, is still compared on every chart.
 */
const ROTATION_DEPENDENT = new Set(["天盤", "門", "星", "神"]);

/** Every field of one chart, compared against one upstream dict. */
function diffChart(chart: QimenChart, want: Upstream): string[] {
  const isYin = String(want["排局"]).startsWith("陰");
  const out: string[] = [];
  const say = (field: string, got: unknown, expected: unknown) =>
    out.push(`${field}: got ${JSON.stringify(got)}, want ${JSON.stringify(expected)}`);

  const p = chart.pillars;
  // Year/month now switch at the exact term minute (deviations.spec.ts D9) and
  // so diverge from upstream's day-granular corpus on 節 days before the term
  // minute. The 盤面 is untouched by D9; only the day/hour pillars stay
  // directly comparable here.
  const gz = want["干支"] as string;
  const di = gz.indexOf("日"), hi = gz.indexOf("時");
  const wantDay = gz.slice(di - 2, di);
  const wantHour = gz.slice(hi - 2, hi);
  if (p.day !== wantDay) say("日柱", p.day, wantDay);
  if (p.hour !== wantHour) say("時柱", p.hour, wantHour);

  const scalars: Array<[string, unknown]> = [
    ["排盤方式", chart.methodName],
    ["旬首", chart.xunStem],
    ["局日", chart.juDay],
    ["排局", chart.ju],
    ["節氣", chart.jieqi],
    ["天乙", chart.tianyi],
  ];
  for (const [key, got] of scalars) if (got !== want[key]) say(key, got, want[key]);

  const kong = want["旬空"] as Record<string, string>;
  if (chart.kong.day !== kong["日空"] || chart.kong.hour !== kong["時空"]) say("旬空", chart.kong, kong);

  const zz = chart.zhifuZhishi;
  const mineZz = { 值符天干: zz.zhifuStem, 值符星宮: zz.zhifuStar, 值使門宮: zz.zhishiDoor };
  if (JSON.stringify(mineZz) !== JSON.stringify(want["值符值使"])) say("值符值使", mineZz, want["值符值使"]);

  const ma = want["馬星"] as Record<string, string>;
  const h = chart.horses;
  if (h.tianMa !== ma["天馬"] || h.dingMa !== ma["丁馬"] || h.yiMa !== ma["驛馬"]) say("馬星", h, ma);

  const plates: Array<[string, Record<string, string>]> = [
    ["天盤", chart.skyPlate],
    ["地盤", chart.earthPlate],
    ["門", chart.doors],
    ["星", chart.stars],
    ["神", chart.gods],
  ];
  for (const [key, mine] of plates) {
    if (isYin && ROTATION_DEPENDENT.has(key)) continue;
    const expected = want[key] as Record<string, string>;
    for (const gong of new Set([...Object.keys(mine), ...Object.keys(expected)])) {
      if (mine[gong] !== expected[gong]) {
        say(`${key} ${gong}`, mine[gong], expected[gong]);
        break;
      }
    }
  }

  // 長生運 is not compared at all. Upstream reads the *day stem's* cycle through
  // a branch-to-stem table, so its answer does not depend on the palace being
  // read; this engine reads the palace's own stem at the palace's own branch,
  // and reports one stage per branch because a corner palace covers two. The
  // two are different quantities, not different values of one — see
  // PORTING-NOTES D11, pinned by deviations.spec.ts.

  return out;
}

describe("hour corpus", () => {
  it("is non-trivial and upstream never raised on it", () => {
    expect(cases.length).toBeGreaterThan(1_000);
    const raised = all.cases.filter((c) => "__error__" in c.chaibu || "__error__" in c.zhirun);
    expect(raised).toHaveLength(0);
  });
});

for (const method of METHODS) {
  describe(`時家 ${method}`, () => {
    it("every field of every chart matches upstream", () => {
      const failures: string[] = [];
      for (const c of cases) {
        const want = c[method as keyof ChartCase] as Upstream;
        for (const diff of diffChart(buildChart(toCivil(c.input), method), want)) {
          failures.push(`${label(c.input)} ${diff}`);
        }
      }
      expect(failures.slice(0, 15)).toEqual([]);
      expect(failures).toHaveLength(0);
    }, 120_000);
  });
}
