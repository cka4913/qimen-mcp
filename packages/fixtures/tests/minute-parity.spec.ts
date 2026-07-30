/**
 * P4 gate: the whole 刻家 chart against upstream's `pan_minute()`.
 *
 * The corpus leans on every ten-minute 刻 boundary and the minute either side
 * of it, since that is the only place the 刻柱 can shift.
 */
import { describe, expect, it } from "vitest";
import { buildKeChart, type Method } from "@cka4913/qimen-core";
import { label, loadMinute, toCivil, upstreamHourIsSound, type ChartCase } from "../src/index.js";

const all = loadMinute();
const cases = all.cases.filter((c) => upstreamHourIsSound(c.input));
const METHODS: Method[] = ["chaibu", "zhirun"];

type Upstream = Record<string, any>;

function diffChart(chart: ReturnType<typeof buildKeChart>, want: Upstream): string[] {
  const out: string[] = [];
  const say = (field: string, got: unknown, expected: unknown) =>
    out.push(`${field}: got ${JSON.stringify(got)}, want ${JSON.stringify(expected)}`);

  const p = chart.pillars;
  // Year/month switch at the exact term minute (deviations.spec.ts D9); compare
  // day/hour/ke only. The 盤面 is untouched by D9.
  const gz = want["干支"] as string;
  const di = gz.indexOf("日"), hi = gz.indexOf("時"), ki = gz.indexOf("分");
  const wantDay = gz.slice(di - 2, di);
  const wantHour = gz.slice(hi - 2, hi);
  const wantKe = gz.slice(ki - 2, ki);
  if (p.day !== wantDay) say("日柱", p.day, wantDay);
  if (p.hour !== wantHour) say("時柱", p.hour, wantHour);
  if (p.ke !== wantKe) say("刻柱", p.ke, wantKe);

  const scalars: Array<[string, unknown]> = [
    ["排盤方式", chart.methodName],
    ["旬首", chart.xunStem],
    ["局日", chart.juDay],
    ["排局", chart.ju],
    ["節氣", chart.jieqi],
    ["天乙", chart.tianyi],
    ["飛干", chart.angan.flying],
  ];
  for (const [key, got] of scalars) if (got !== want[key]) say(key, got, want[key]);

  // Upstream labels the 刻家 pair 日空/時空; they are in fact the hour and 刻 voids.
  const kong = want["旬空"] as Record<string, string>;
  if (chart.kong.hour !== kong["日空"] || chart.kong.ke !== kong["時空"]) say("旬空", chart.kong, kong);

  const zz = chart.zhifuZhishi;
  const wantZz = want["值符值使"] as Record<string, unknown>;
  if (JSON.stringify(zz.zhifuStar) !== JSON.stringify(wantZz["值符星宮"])) {
    say("值符星宮", zz.zhifuStar, wantZz["值符星宮"]);
  }
  if (JSON.stringify(zz.zhishiDoor) !== JSON.stringify(wantZz["值使門宮"])) {
    say("值使門宮", zz.zhishiDoor, wantZz["值使門宮"]);
  }
  if (zz.zhifuStem[1] !== wantZz["值符天干"]) say("值符天干", zz.zhifuStem[1], wantZz["值符天干"]);

  const ma = want["馬星"] as Record<string, string>;
  const h = chart.horses;
  if (h.tianMa !== ma["天馬"] || h.dingMa !== ma["丁馬"] || h.yiMa !== ma["驛馬"]) say("馬星", h, ma);

  const plates: Array<[string, Record<string, string>]> = [
    ["天盤", chart.skyPlate],
    ["地盤", chart.earthPlate],
    ["門", chart.doors],
    ["星", chart.stars],
    ["神", chart.gods],
    ["暗干", chart.angan.hidden],
  ];
  for (const [key, mine] of plates) {
    const expected = want[key] as Record<string, string>;
    for (const gong of new Set([...Object.keys(mine), ...Object.keys(expected)])) {
      if (mine[gong] !== expected[gong]) {
        say(`${key} ${gong}`, mine[gong], expected[gong]);
        break;
      }
    }
  }

  return out;
}

describe("minute corpus", () => {
  it("is non-trivial and upstream never raised on it", () => {
    expect(cases.length).toBeGreaterThan(300);
    expect(all.cases.filter((c) => "__error__" in c.chaibu || "__error__" in c.zhirun)).toHaveLength(0);
  });
});

for (const method of METHODS) {
  describe(`刻家 ${method}`, () => {
    it("every field of every chart matches upstream", () => {
      const failures: string[] = [];
      for (const c of cases) {
        const want = c[method as keyof ChartCase] as Upstream;
        for (const diff of diffChart(buildKeChart(toCivil(c.input), method), want)) {
          failures.push(`${label(c.input)} ${diff}`);
        }
      }
      expect(failures.slice(0, 15)).toEqual([]);
      expect(failures).toHaveLength(0);
    }, 120_000);
  });
}
