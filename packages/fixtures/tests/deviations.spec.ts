/**
 * Deliberate departures from upstream.
 *
 * Every case where this port knowingly produces something other than
 * `kentang2017/kinqimen` lives here, pinned by a test. A deviation that is not
 * in this file is a bug, and a deviation whose test stops failing upstream is a
 * deviation that should be removed.
 *
 * Prose for each entry is in docs/PORTING-NOTES.md.
 */
import { describe, expect, it } from "vitest";
import {
  JIAZI,
  PALACE_BRANCHES,
  TIAN_GAN,
  UPSTREAM_YIN_EIGHTGUA_ORDER,
  addDays,
  buildChart,
  compare,
  hourBranch,
  jieqiMomentInYear,
  jieqiName,
  palacesAtStage,
  pillars,
  rotationOrder,
  stageInPalace,
} from "@cka4913/qimen-core";
import {
  EPHEM_PRECISION_BREAKDOWN,
  label,
  loadCalendar,
  toCivil,
  upstreamHourIsSound,
  type CalendarCase,
} from "../src/index.js";

const corpus = loadCalendar();

describe("D1 · the hour is read directly, not through ephem", () => {
  const affected = corpus.cases.filter((c) => !upstreamHourIsSound(c.input));

  it("the corpus actually covers dates past the breakdown", () => {
    expect(affected.length).toBeGreaterThan(100);
  });

  it("every disagreement past the breakdown is upstream reading the hour one lower", () => {
    const unexplained: string[] = [];
    for (const c of affected) {
      const dt = toCivil(c.input);
      const got = pillars(dt);
      if (got.hour === c.ganzhi[3]) continue;
      // Upstream lost a microsecond and truncated into the previous hour. Its
      // hour pillar should be the one this port would produce an hour earlier.
      const oneHourEarlier = pillars({ ...dt, hour: dt.hour === 0 ? 23 : dt.hour - 1 });
      if (oneHourEarlier.hour !== c.ganzhi[3]) {
        unexplained.push(`${label(c.input)}: upstream ${c.ganzhi[3]}, ours ${got.hour}, ours-1h ${oneHourEarlier.hour}`);
      }
    }
    expect(unexplained.slice(0, 10)).toEqual([]);
    expect(unexplained).toHaveLength(0);
  });

  it("this port's hour branch follows the clock, including past the breakdown", () => {
    const b = EPHEM_PRECISION_BREAKDOWN;
    const dt = { year: b.year + 1, month: b.month, day: b.day, hour: 5, minute: 30 };
    expect(hourBranch(dt.hour)).toBe("卯");
    expect(pillars(dt).hour.endsWith("卯")).toBe(true);
  });

  it("before the breakdown the two agree exactly, so the deviation is bounded", () => {
    const sound = corpus.cases.filter((c: CalendarCase) => upstreamHourIsSound(c.input));
    const failures = sound.filter((c) => pillars(toCivil(c.input)).hour !== c.ganzhi[3]);
    expect(failures.map((c) => label(c.input)).slice(0, 10)).toEqual([]);
  });
});

describe("D9 · month and year pillars switch at the exact term minute, not at 00:00", () => {
  // Upstream (and this port, before D9) used lunar-javascript's day-granular
  // month/year: the whole 節 day carries the new pillar from 00:00. This port
  // now derives both from the term's exact minute, judged against the *original*
  // civil moment (the 23:00 晚子時 rollover belongs to the day/hour pillars only),
  // so the month pillar is always consistent with the 節氣 field of the same
  // chart (the contradiction #53 reported), and the year pillar follows 立春 to
  // the minute. Upstream's own day-granular month pillar sometimes disagrees
  // with its own 節氣 field, so the divergence from the corpus is wider than just
  // the 節-day pre-minute window — that is expected, and is the inconsistency D9
  // removes.
  const sound = corpus.cases.filter((c) => upstreamHourIsSound(c.input));

  const JIE_TO_BRANCH: Record<string, string> = {
    立春: "寅", 驚蟄: "卯", 清明: "辰", 立夏: "巳", 芒種: "午", 小暑: "未",
    立秋: "申", 白露: "酉", 寒露: "戌", 立冬: "亥", 大雪: "子", 小寒: "丑",
  };
  const QI_TO_JIE: Record<string, string> = {
    雨水: "立春", 春分: "驚蟄", 穀雨: "清明", 小滿: "立夏", 夏至: "芒種", 大暑: "小暑",
    處暑: "立秋", 秋分: "白露", 霜降: "寒露", 小雪: "立冬", 冬至: "大雪", 大寒: "小寒",
  };
  const impliedBranch = (term: string) => JIE_TO_BRANCH[term in JIE_TO_BRANCH ? term : QI_TO_JIE[term]];
  const ganzhiOfYear = (year: number) => JIAZI[((((year - 4) % 60) + 60) % 60)];

  it("the month pillar is always consistent with the 節氣 term period (no internal contradiction)", () => {
    const bad: string[] = [];
    for (const c of sound) {
      const dt = toCivil(c.input);
      const got = pillars(dt).month;
      const term = jieqiName(dt);
      const want = impliedBranch(term);
      if (got[1] !== want) bad.push(`${label(c.input)}: month ${got} vs term ${term}→${want}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(bad).toHaveLength(0);
  });

  it("the year pillar follows the exact 立春 boundary", () => {
    const bad: string[] = [];
    for (const c of sound) {
      const dt = toCivil(c.input);
      const lichun = jieqiMomentInYear(dt.year, "立春");
      const eff = compare(dt, lichun) >= 0 ? dt.year : dt.year - 1;
      const want = ganzhiOfYear(eff);
      if (pillars(dt).year !== want) bad.push(`${label(c.input)}: year ${pillars(dt).year} vs exact-立春 ${want}`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(bad).toHaveLength(0);
  });

  it("diverges from upstream's day-granular month/year, and the divergence is bounded", () => {
    let monthDiv = 0;
    let yearDiv = 0;
    for (const c of sound) {
      const got = pillars(toCivil(c.input));
      if (got.month !== c.ganzhi[1]) monthDiv++;
      if (got.year !== c.ganzhi[0]) yearDiv++;
    }
    // The fix changes something on both pillars...
    expect(monthDiv).toBeGreaterThan(0);
    expect(yearDiv).toBeGreaterThan(0);
    // ...more for the month (12 節 boundaries a year) than the year (one 立春)...
    expect(monthDiv).toBeGreaterThan(yearDiv);
    // ...yet the exact-term pillars still agree with upstream on the large
    // majority of sampled moments. (Wider than a naive 節-day-pre-minute window
    // because upstream's own day-granular month pillar sometimes contradicts its
    // own 節氣 field — the very inconsistency D9 removes.)
    expect(monthDiv).toBeLessThan(sound.length * 0.15);
    expect(yearDiv).toBeLessThan(sound.length * 0.05);
  });

  // A 節/立春 in the 23:xx hour or at 00:00 is the case that broke consistency
  // before the fix. Because year/month are now judged against the ORIGINAL civil
  // moment (not the 晚子時-rolled day), the term's own minute is reachable as a
  // query, so we can pin the switch to the minute rather than just the hour.
  function shiftMin(m: { year: number; month: number; day: number; hour: number; minute: number }, delta: number) {
    const total = m.hour * 60 + m.minute + delta;
    const dayDelta = Math.floor(total / 1440);
    const rem = ((total % 1440) + 1440) % 1440;
    const d = addDays({ year: m.year, month: m.month, day: m.day }, dayDelta);
    return { year: d.year, month: d.month, day: d.day, hour: Math.floor(rem / 60), minute: rem % 60 };
  }

  it("at every 23:xx/00:00 節/立春, month & year switch on the exact term minute and agree with 節氣", () => {
    const bad: string[] = [];
    let edgeCount = 0;
    for (let y = 1900; y <= 2100; y++) {
      for (const jie of Object.keys(JIE_TO_BRANCH)) {
        const m = jieqiMomentInYear(y, jie);
        if (m.hour !== 23 && !(m.hour === 0 && m.minute === 0)) continue;
        edgeCount++;
        for (const q of [shiftMin(m, -1), m, shiftMin(m, +1)] as const) {
          const p = pillars(q);
          const term = jieqiName(q);
          const wantBranch = impliedBranch(term);
          if (p.month[1] !== wantBranch) bad.push(`${jie} ${y} @${q.hour}:${q.minute} month ${p.month} vs ${term}→${wantBranch}`);
          if (jie === "立春") {
            const eff = compare(q, m) >= 0 ? y : y - 1;
            if (p.year !== ganzhiOfYear(eff)) bad.push(`立春 ${y} @${q.hour}:${q.minute} year ${p.year} vs ${ganzhiOfYear(eff)}`);
          }
        }
        // the switch lands on the minute, not early/late within the hour
        const mb = pillars(shiftMin(m, -1)).month[1];
        const ma = pillars(m).month[1];
        const mf = pillars(shiftMin(m, +1)).month[1];
        if (mb === ma) bad.push(`${jie} ${y}: month did not switch at the term minute ${m.hour}:${m.minute}`);
        if (ma !== mf) bad.push(`${jie} ${y}: month did not hold after the term minute`);
        if (jie === "立春") {
          const yb = pillars(shiftMin(m, -1)).year;
          const ya = pillars(m).year;
          const yf = pillars(shiftMin(m, +1)).year;
          if (yb === ya) bad.push(`立春 ${y}: year did not switch at the term minute ${m.hour}:${m.minute}`);
          if (ya !== yf) bad.push(`立春 ${y}: year did not hold after the term minute`);
        }
      }
    }
    expect(edgeCount).toBe(103); // 101 in 23:xx + 2 at 00:00 across 1900–2100
    expect(bad.slice(0, 10)).toEqual([]);
    expect(bad).toHaveLength(0);
  });
});


/**
 * D10 · 陰遁 walks the plain reverse of clockwise, not upstream's order.
 *
 * Upstream uses `艮乾兌坤離巽震坎` — the plain reverse with 艮 lifted from
 * seventh place to first — which this port copied until it could be checked
 * against something other than upstream itself. It cannot be checked against
 * the corpus, because the corpus *is* upstream.
 *
 * So it was checked against a third implementation (奇門實用版 v7.88). The two
 * charts below are transcribed from it; the plain reverse reproduces them
 * exactly, and upstream's order does not. The transcription and the wider
 * experiment are in test-case/FINDINGS.md.
 *
 * Consequence: on 陰遁 charts this port disagrees with upstream on the sky
 * plate, gates, stars and gods, which is why hour-parity and patterns-parity
 * exclude those. 陽遁 is untouched — measured over the corpus, 4,415 陽遁
 * charts differ in nothing at all, while all 3,809 陰遁 charts differ.
 */
describe("D10 · the 陰遁 rotation order", () => {
  /** 2026-08-03, 陰遁七局拆補, transcribed from the reference implementation. */
  const REFERENCE: Array<{
    label: string;
    dt: { year: number; month: number; day: number; hour: number; minute: number };
    sky: Record<string, string>;
    doors: Record<string, string>;
    gods: Record<string, string>;
  }> = [
    {
      label: "2026-08-03 寅時",
      dt: { year: 2026, month: 8, day: 3, hour: 3, minute: 0 },
      sky: { 巽: "癸", 離: "戊", 坤: "己", 震: "丙", 兌: "丁", 艮: "辛", 坎: "壬", 乾: "乙" },
      doors: { 巽: "景", 離: "死", 坤: "驚", 震: "杜", 兌: "開", 艮: "傷", 坎: "生", 乾: "休" },
      gods: { 巽: "蛇", 離: "符", 坤: "天", 震: "陰", 兌: "地", 艮: "合", 坎: "虎", 乾: "玄" },
    },
    {
      label: "2026-08-03 未時",
      dt: { year: 2026, month: 8, day: 3, hour: 14, minute: 25 },
      sky: { 巽: "戊", 離: "己", 坤: "丁", 震: "癸", 兌: "乙", 艮: "丙", 坎: "辛", 乾: "壬" },
      doors: { 巽: "死", 離: "驚", 坤: "開", 震: "景", 兌: "休", 艮: "杜", 坎: "傷", 乾: "生" },
      gods: { 巽: "符", 離: "天", 坤: "地", 震: "蛇", 兌: "玄", 艮: "陰", 坎: "合", 乾: "虎" },
    },
  ];

  it("is the plain reverse of clockwise, and differs from upstream's only in where 艮 sits", () => {
    expect(rotationOrder("陰").join("")).toBe("乾兌坤離巽震艮坎");
    expect(UPSTREAM_YIN_EIGHTGUA_ORDER.join("")).toBe("艮乾兌坤離巽震坎");
    // Same cycle, 艮 moved from the seventh position to the first.
    const withoutGen = (o: string[]) => o.filter((g) => g !== "艮").join("");
    expect(withoutGen(rotationOrder("陰"))).toBe(withoutGen([...UPSTREAM_YIN_EIGHTGUA_ORDER]));
  });

  it("reproduces the reference implementation on every transcribed 陰遁 chart", () => {
    const failures: string[] = [];
    for (const ref of REFERENCE) {
      const chart = buildChart(ref.dt, "chaibu");
      expect(chart.ju, ref.label).toBe("陰遁七局上");
      for (const [layer, mine, want] of [
        ["天盤", chart.skyPlate, ref.sky],
        ["門", chart.doors, ref.doors],
        ["神", chart.gods, ref.gods],
      ] as const) {
        for (const [gong, expected] of Object.entries(want)) {
          if (mine[gong] !== expected) {
            failures.push(`${ref.label} ${layer} ${gong}: got ${mine[gong]}, want ${expected}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("upstream's order would fail those same charts, so the test has teeth", () => {
    // Rebuild the sky plate the way upstream orders the palaces and confirm it
    // disagrees — otherwise the assertion above would pass either way.
    const ref = REFERENCE[0]!;
    const chart = buildChart(ref.dt, "chaibu");
    const upstreamOrder = [...UPSTREAM_YIN_EIGHTGUA_ORDER];
    const ours = rotationOrder("陰");
    // 艮 and 坎 are the palaces the displacement lands on.
    expect(upstreamOrder.indexOf("艮")).not.toBe(ours.indexOf("艮"));
    expect(chart.doors["艮"]).not.toBe(chart.doors["坎"]);
  });

  it("leaves 陽遁 untouched — the corpus still compares those in full", () => {
    // 2027-03-15 11:00 is the 陽遁 chart the reference implementation matched
    // field for field before this change; it must still match after it.
    const chart = buildChart({ year: 2027, month: 3, day: 15, hour: 11, minute: 0 }, "chaibu");
    expect(chart.ju).toBe("陽遁四局下");
    expect(chart.skyPlate).toMatchObject({ 巽: "癸", 離: "丙", 坤: "辛", 震: "戊", 兌: "庚", 艮: "乙", 坎: "壬", 乾: "丁" });
    expect(chart.doors).toMatchObject({ 巽: "景", 離: "死", 坤: "驚", 震: "杜", 兌: "開", 艮: "傷", 坎: "生", 乾: "休" });
  });
});


/**
 * D11 · 十二長生 reads the palace's own stem at the palace's own branch.
 *
 * Upstream takes the *day stem's* cycle and re-keys it through a fixed
 * branch-to-stem table, so the stage it reports for a palace does not depend on
 * that palace at all. That is not a variant reading; it is a different
 * quantity, and it disagrees with both the reference implementation and the
 * upstream issue that reported it (#56).
 *
 * The rule was pinned from two directions. The reference implementation's
 * 長生 table lists, for each palace, which stems reach 長生 there — reproduced
 * exactly below. And its charts flag a stem sitting in its own 墓 palace, which
 * on the issue's own example (2025-07-28 15:00) marks both 癸 in 坤 and 辛 in 巽.
 *
 * An earlier draft of this deviation said corner palaces take the *earlier* of
 * their two branches. That was wrong, and instructive: every corner palace's 墓
 * branch happens to be its earlier one, so 墓 evidence alone cannot separate the
 * two models and those two hits were guaranteed either way. The 長生 branches
 * are all the *later* ones, which is what settles it — see test-case/FINDINGS.md.
 */
describe("D11 · 十二長生", () => {
  /** Transcribed from the reference implementation's 長生 reference table. */
  const REFERENCE_CHANGSHENG: Record<string, string[]> = {
    坎: ["辛"],
    艮: ["丙", "戊"],
    震: ["癸"],
    巽: ["庚"],
    離: ["乙"],
    坤: ["壬"],
    兌: ["丁", "己"],
    乾: ["甲"],
  };

  it("reproduces the reference 長生 table for all ten stems", () => {
    const mine: Record<string, string[]> = {};
    for (const stem of TIAN_GAN) {
      for (const gong of palacesAtStage(stem, "長生")) (mine[gong] ??= []).push(stem);
    }
    for (const [gong, want] of Object.entries(REFERENCE_CHANGSHENG)) {
      expect([...(mine[gong] ?? [])].sort(), gong).toEqual([...want].sort());
    }
    // Ten stems, each 長生 in exactly one palace.
    expect(Object.values(mine).flat()).toHaveLength(10);
  });

  it("a corner palace covers both branches, so the earlier-branch reading is wrong", () => {
    // 庚's 長生 is 巳, the *later* branch of 巽. Under an earlier-branch-only
    // reading 庚 would be 養 there and would not appear in the table at all.
    expect(stageInPalace("庚", "巽").stages).toEqual([
      { branch: "辰", stage: "養" },
      { branch: "巳", stage: "長生" },
    ]);
    expect(palacesAtStage("庚", "長生")).toEqual(["巽"]);
  });

  it("flags 入墓 on the issue's own example, which upstream got wrong", () => {
    // 2025-07-28 15:00 陰遁七局拆補: the reference marks 墓 on both of these.
    // Upstream — and this port before the fix — gave 癸 in 坤 as 胎.
    for (const [stem, gong] of [
      ["癸", "坤"],
      ["辛", "巽"],
    ] as const) {
      const s = stageInPalace(stem, gong);
      expect(s.entombed, `${stem}@${gong}`).toBe(true);
      expect(s.stages.some((x) => x.stage === "墓"), `${stem}@${gong}`).toBe(true);
    }
    const chart = buildChart({ year: 2025, month: 7, day: 28, hour: 15, minute: 0 }, "chaibu");
    expect(chart.earthPlate["坤"]).toBe("癸");
    expect(chart.stages.earth["坤"]!.entombed).toBe(true);
  });

  it("gives 中宮 no stage, because it has no branch", () => {
    expect(PALACE_BRANCHES["中"]).toBeUndefined();
    expect(stageInPalace("庚", "中")).toEqual({ stem: "庚", stages: [], entombed: false });
  });

  it("reports one stage per branch, never a single label for a corner palace", () => {
    const chart = buildChart({ year: 2027, month: 3, day: 15, hour: 11, minute: 0 }, "chaibu");
    for (const [gong, entry] of Object.entries(chart.stages.earth)) {
      const branches = PALACE_BRANCHES[gong] ?? [];
      expect(entry.stages.map((s) => s.branch), gong).toEqual([...branches]);
    }
    // 巽 is a corner: two branches, and here they genuinely disagree.
    const xun = chart.stages.earth["巽"]!;
    expect(xun.stages).toHaveLength(2);
    expect(xun.stages[0]!.stage).not.toBe(xun.stages[1]!.stage);
  });
});
