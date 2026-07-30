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
import { addDays, compare, hourBranch, jieqiMomentInYear, jieqiName, pillars, JIAZI } from "@cka4913/qimen-core";
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
