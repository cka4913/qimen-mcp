/**
 * 干支 pillars.
 *
 * Upstream `jieqi.gangzhi()` returns five strings: 年柱, 月柱, 日柱, 時柱, 刻柱.
 * Two of its habits are load-bearing and are reproduced exactly:
 *
 *  1. **23:00 belongs to the next day.** The hour is resolved against the
 *     *following* calendar day at 00:00, so both the day pillar and the hour
 *     pillar advance. (晚子時 convention.)
 *  2. **The 刻 sequence is anchored on the original day**, not the shifted one:
 *     upstream computes its anchor from `gangzhi1(y, m, d, 0, 0)`, using the
 *     unshifted date even when the hour is 23.
 *
 * Neither is a bug; both change which 局 you land on, so "fixing" either would
 * silently produce different charts from every published kinqimen reading.
 */
import { Solar } from "lunar-javascript";
import { DI_ZHI, JIAZI, TIAN_GAN } from "./constants.js";
import { addDays, assertSupported, beforeJieqiStart, compare, currentJieqiStart, dtKey, jieqiMomentInYear, nextJieqiStart, type CivilDateTime } from "./calendar.js";
import { memoize, multiKeyGet, rotate, splitList, zipRecord } from "./util.js";
import { KinqimenError, must } from "./errors.js";

export interface Pillars {
  /** 年柱 */
  year: string;
  /** 月柱 */
  month: string;
  /** 日柱 */
  day: string;
  /** 時柱 */
  hour: string;
  /** 刻柱 — the 10-minute subdivision used by 刻家奇門 */
  ke: string;
}

/** 五虎遁: year stem → 正月 pillar, then the twelve months in order. */
const FIVE_TIGERS: ReadonlyArray<readonly [readonly string[], string]> = [
  [[..."甲己"], "丙寅"],
  [[..."乙庚"], "戊寅"],
  [[..."丙辛"], "庚寅"],
  [[..."丁壬"], "壬寅"],
  [[..."戊癸"], "甲寅"],
];

/** 五鼠遁: day stem → 子時 pillar, then the twelve double-hours. */
const FIVE_RATS: ReadonlyArray<readonly [readonly string[], string]> = [
  [[..."甲己"], "甲子"],
  [[..."乙庚"], "丙子"],
  [[..."丙辛"], "戊子"],
  [[..."丁壬"], "庚子"],
  [[..."戊癸"], "壬子"],
];

/** 五馬遁: hour stem → 子刻 pillar, then the sixty 刻 in order. */
const FIVE_HORSES: ReadonlyArray<readonly [readonly string[], string]> = [
  [[..."丙辛"], "甲午"],
  [[..."丁壬"], "丙午"],
  [[..."戊癸"], "戊午"],
  [[..."甲己"], "庚午"],
  [[..."乙庚"], "壬午"],
];

/** A 節 (not 氣) and the month branch it opens. */
const JIE_TO_MONTH_BRANCH: Record<string, string> = {
  立春: "寅", 驚蟄: "卯", 清明: "辰", 立夏: "巳", 芒種: "午", 小暑: "未",
  立秋: "申", 白露: "酉", 寒露: "戌", 立冬: "亥", 大雪: "子", 小寒: "丑",
};

/** A 氣 → the 節 immediately before it, which still governs the month branch. */
const QI_TO_PRECEDING_JIE: Record<string, string> = {
  雨水: "立春", 春分: "驚蟄", 穀雨: "清明", 小滿: "立夏", 夏至: "芒種", 大暑: "小暑",
  處暑: "立秋", 秋分: "白露", 霜降: "寒露", 小雪: "立冬", 冬至: "大雪", 大寒: "小寒",
};

/** Month branch → its position in the 寅-first order 五虎遁 walks (正月..腊月). */
const BRANCH_TO_LUNAR_MONTH: Record<string, number> = {
  寅: 1, 卯: 2, 辰: 3, 巳: 4, 午: 5, 未: 6, 申: 7, 酉: 8, 戌: 9, 亥: 10, 子: 11, 丑: 12,
};

/**
 * Upstream's lookup habit: try the stem, and if that misses try the branch.
 * The fallback only ever fires for tables keyed by stems when handed a pillar
 * whose stem is absent — it is kept because a few call sites depend on it.
 */
function stemThenBranch(table: ReadonlyArray<readonly [readonly string[], string]>, pillar: string): string {
  const byStem = multiKeyGet(table, pillar[0] as string);
  if (byStem !== undefined) return byStem;
  return must(multiKeyGet(table, pillar[1] as string), "pillar in stem table", { pillar });
}

/** `jieqi.find_lunar_month` — 正月..十二月 pillars for a year pillar. */
export function lunarMonthPillars(yearPillar: string): Record<number, string> {
  const head = stemThenBranch(FIVE_TIGERS, yearPillar);
  const twelve = rotate(JIAZI, head).slice(0, 12);
  const out: Record<number, string> = {};
  twelve.forEach((p, i) => (out[i + 1] = p));
  return out;
}

/** `jieqi.find_lunar_hour` — branch → 時柱 for a day pillar. */
export function lunarHourPillars(dayPillar: string): Record<string, string> {
  const head = stemThenBranch(FIVE_RATS, dayPillar);
  return zipRecord(DI_ZHI, rotate(JIAZI, head).slice(0, 12));
}

/** `jieqi.find_lunar_ke` — the sixty 刻 pillars in order for an hour pillar. */
export function lunarKeSequence(hourPillar: string): string[] {
  return rotate(JIAZI, stemThenBranch(FIVE_HORSES, hourPillar));
}

/**
 * `jieqi.ke_jiazi_d` — "H:MM" (minutes rounded down to a multiple of ten) →
 * 刻柱, cycling the sixty pillars across the day's 144 ten-minute slots.
 */
export function keTable(ziHourPillar: string): Record<string, string> {
  const seq = lunarKeSequence(ziHourPillar);
  const out: Record<string, string> = {};
  let i = 0;
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 6; m++) {
      out[`${h}:${m}0`] = seq[i % seq.length] as string;
      i++;
    }
  }
  return out;
}

/** The 地支 of a clock hour: 23:00–00:59 is 子, and so on. */
export function hourBranch(hour: number): string {
  return DI_ZHI[Math.floor((((hour + 1) % 24) / 2)) % 12] as string;
}

/**
 * The date/hour a query actually resolves against: 23:00 rolls over to the next
 * day at 00:00. `ephem` in upstream does nothing here beyond this rollover.
 */
function resolveDateHour(dt: CivilDateTime): { year: number; month: number; day: number; hour: number } {
  if (dt.hour === 23) {
    const next = addDays({ year: dt.year, month: dt.month, day: dt.day }, 1);
    return { ...next, hour: 0 };
  }
  return { year: dt.year, month: dt.month, day: dt.day, hour: dt.hour };
}

/** The month branch a moment falls in, from the exact 節 boundaries (D9). */
function monthBranchAt(moment: CivilDateTime): string {
  // Read the term period directly from the table-backed helpers rather than
  // `jieqiName`, which asserts the supported range: the 23:00 rollover can push
  // a valid 2100-12-31 23:xx query into year 2101, still inside the table
  // (1898–2102) but outside `assertSupported`'s 1900–2100.
  const start = currentJieqiStart(moment);
  const next = nextJieqiStart(moment);
  const term = compare(start, moment) <= 0 && compare(moment, next) < 0 ? start.name : beforeJieqiStart(moment).name;
  const jie = term in JIE_TO_MONTH_BRANCH ? term : must(QI_TO_PRECEDING_JIE[term], "preceding 節 for 氣", { term });
  return must(JIE_TO_MONTH_BRANCH[jie], "month branch for jieqi", { jie });
}

/** The year ganzhi, switching at the exact 立春 moment rather than at 00:00 (D9). */
function yearGanZhiExact(moment: CivilDateTime): string {
  const lichun = jieqiMomentInYear(moment.year, "立春");
  const effectiveYear = compare(moment, lichun) >= 0 ? moment.year : moment.year - 1;
  return must(JIAZI[((((effectiveYear - 4) % 60) + 60) % 60)], "year ganzhi", { effectiveYear });
}

/** The first four pillars — `jieqi.gangzhi1` minus the 刻 column. */
function fourPillars(dt: CivilDateTime): { year: string; month: string; day: string; hour: string } {
  // The 23:00 rollover (晚子時) belongs to the *day* and *hour* pillars only:
  // 23:00–23:59 is the 子時 attributed to the following calendar day. The year
  // and month pillars are judged against the civil moment the user actually
  // gave, exactly as `jieqiName` is — otherwise a 節/立春 in the 23:xx hour would
  // see the month/year advance a minute before `節氣` does, leaving the same
  // chart self-contradictory (the very inconsistency #53 set out to remove).
  const r = resolveDateHour(dt);
  const lunar = Solar.fromYmd(r.year, r.month, r.day).getLunar();
  const dayPillar = lunar.getDayInGanZhi();
  const yearPillar = yearGanZhiExact(dt);
  // Month branch switches at the exact 節 minute; the stem follows by 五虎遁 (D9).
  const branch = monthBranchAt(dt);
  const monthPillar = must(
    lunarMonthPillars(yearPillar)[must(BRANCH_TO_LUNAR_MONTH[branch], "lunar month for branch", { branch })],
    "month pillar",
    { ...dt }
  );
  const hourPillar = must(lunarHourPillars(dayPillar)[hourBranch(r.hour)], "hour pillar", { ...dt });
  return { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar };
}

/** `jieqi.gangzhi` — all five pillars. */
function pillarsUncached(dt: CivilDateTime): Pillars {
  assertSupported(dt);
  const four = fourPillars(dt);
  // The 刻 anchor deliberately uses the *unshifted* day at midnight.
  const ziHour = fourPillars({ ...dt, hour: 0, minute: 0 }).hour;
  const slot = `${dt.hour}:${Math.floor(dt.minute / 10)}0`;
  const ke = must(keTable(ziHour)[slot], "ke pillar", { ...dt, slot });
  return { ...four, ke };
}

export const pillars = memoize(dtKey, pillarsUncached);

/** `config.shun` — the 旬首 stem (遁甲) for a pillar. */
export function xunStem(pillar: string): string {
  const branchIndex = DI_ZHI.indexOf(pillar[1] as string) + 1;
  const stemIndex = TIAN_GAN.indexOf(pillar[0] as string) + 1;
  let value = branchIndex - stemIndex;
  if (value < 0) value += 12;
  const table: Record<number, string> = { 0: "戊", 10: "己", 8: "庚", 6: "辛", 4: "壬", 2: "癸" };
  return must(table[value], "xun stem", { pillar });
}

/** `config.liujiashun_dict` — pillar → the 甲-headed pillar of its 旬. */
export function xunHead(pillar: string): string {
  const heads = JIAZI.filter((_, i) => i % 10 === 0);
  for (const head of heads) {
    if (rotate(JIAZI, head).slice(0, 10).includes(pillar)) return head;
  }
  throw new KinqimenError("TABLE_LOOKUP_FAILED", "xun head not found", { pillar });
}

/** `config.findyuen_dict` — pillar → 上/中/下 元, in blocks of five. */
export function sanyuanOf(pillar: string): string {
  const blocks = splitList(JIAZI, 5);
  const labels = ["上", "中", "下", "上", "中", "下", "上", "中", "下", "上", "中", "下"];
  for (let i = 0; i < blocks.length; i++) {
    if ((blocks[i] as string[]).includes(pillar)) return labels[i] as string;
  }
  throw new KinqimenError("TABLE_LOOKUP_FAILED", "sanyuan not found", { pillar });
}
