/**
 * 排局 — which of the eighteen 陰/陽遁 bureaux a moment falls in.
 *
 * Two schools, both supported, because they genuinely disagree:
 *
 *  - **拆補法** (`chaibu`): the 元 comes straight from the day pillar and the
 *    bureau straight from the solar term. Short, total, no special cases.
 *  - **置閏法** (`zhirun`): the bureau is chosen by how far the day sits from
 *    the term (超神 / 正授 / 接氣 / 閏奇). Upstream's implementation is a long
 *    ladder of hand-fitted special cases keyed on the distance in days, the
 *    lunar month name, the lunar day and whether the 值符天干 is one of the six
 *    儀. It is reproduced branch for branch below — including the branches that
 *    return the same thing on both sides of their own condition — because the
 *    only definition of "correct" here is "what kinqimen produces".
 */
import { CNUMBER, JIEQI_CYCLE } from "./constants.js";
import { currentJieqiStart, dtKey, jieqiName, lunarDate, type CivilDateTime } from "./calendar.js";
import { pillars, sanyuanOf, xunHead } from "./ganzhi.js";
import { memoize, multiKeyGet, rotate, splitList } from "./util.js";
import { must } from "./errors.js";
import { JIAZI, XUN_HEAD_STEM } from "./constants.js";

/** The twelve terms from 冬至 are 陽遁; the twelve from 夏至 are 陰遁. */
export function dunOf(jieqi: string): string {
  const table: ReadonlyArray<readonly [readonly string[], string]> = [
    [rotate(JIEQI_CYCLE, "冬至").slice(0, 12), "陽遁"],
    [rotate(JIEQI_CYCLE, "夏至").slice(0, 12), "陰遁"],
  ];
  return must(multiKeyGet(table, jieqi), "yin/yang dun for solar term", { jieqi });
}

/**
 * `config.jieqicode_jq` — the three bureau numbers (上元, 中元, 下元) of a term,
 * as a three-character string of Chinese numerals.
 */
export function jieqiJuCode(jieqi: string): string {
  const table: ReadonlyArray<readonly [readonly string[], string]> = [
    [["冬至", "驚蟄"], "一七四"],
    [["小寒"], "二八五"],
    [["大寒", "春分"], "三九六"],
    [["立春"], "八五二"],
    [["雨水"], "九六三"],
    [["清明", "立夏"], "四一七"],
    [["穀雨", "小滿"], "五二八"],
    [["芒種"], "六三九"],
    [["夏至", "白露"], "九三六"],
    [["小暑"], "八二五"],
    [["大暑", "秋分"], "七一四"],
    [["立秋"], "二五八"],
    [["處暑"], "一四七"],
    [["霜降", "小雪"], "五八二"],
    [["寒露", "立冬"], "六九三"],
    [["大雪"], "四七一"],
  ];
  return must(multiKeyGet(table, jieqi), "bureau code for solar term", { jieqi });
}

const YUAN_INDEX: Record<string, number> = { 上: 0, 中: 1, 下: 2 };

function juNumber(jieqi: string, yuan: string): string {
  const code = jieqiJuCode(jieqi);
  const i = must(YUAN_INDEX[yuan], "yuan index", { yuan });
  return code[i] as string;
}

/** `config.qimen_ju_name_chaibu` — e.g. `陽遁六局上`. */
function juChaibuUncached(dt: CivilDateTime): string {
  const jieqi = jieqiName(dt);
  const yuan = sanyuanOf(pillars(dt).day);
  return `${dunOf(jieqi)}${juNumber(jieqi, yuan)}局${yuan}`;
}

/** `config.zhifu_tiangan` — the 遁甲 stem of the hour pillar's 旬. */
export function zhifuStem(dt: CivilDateTime): string {
  return must(XUN_HEAD_STEM[xunHead(pillars(dt).hour)], "zhifu stem", { ...dt });
}

/** The three-元 label of a day pillar, in blocks of five within the 六十甲子. */
function sanyuanLabelOfDay(dayPillar: string): string {
  const heads = JIAZI.filter((_, i) => i % 5 === 0);
  const blocks = splitList(JIAZI, 5);
  const table: Record<string, string> = {
    甲子: "上元", 甲午: "上元", 己卯: "上元", 己酉: "上元",
    甲寅: "中元", 甲申: "中元", 己巳: "中元", 己亥: "中元",
    甲辰: "下元", 甲戌: "下元", 己丑: "下元", 己未: "下元",
  };
  for (let i = 0; i < blocks.length; i++) {
    if ((blocks[i] as string[]).includes(dayPillar)) {
      return must(table[heads[i] as string], "sanyuan of day", { dayPillar });
    }
  }
  return must(undefined as string | undefined, "sanyuan block", { dayPillar });
}

export interface ZhirunRaw {
  /** The solar-term period the moment falls in. */
  jieqi: string;
  /** Whole days from the term's moment to the query — upstream's `距節氣差日數`. */
  daysFromJieqi: number;
  /** 上元 / 中元 / 下元, from the day pillar's five-day block. */
  sanyuan: string;
  /** The 遁甲 stem of the hour pillar's 旬. */
  zhifuStem: string;
  /** The bureau code of the *previous* term in the cycle. */
  jieqiJu: string;
  yinyang: string;
  /** The four candidate bureaux the special-case ladder picks between. */
  current: string;
  chaoshen: string;
  other: string;
  other1: string;
}

/**
 * `config.qimen_ju_name_zhirun_raw` — the inputs the 置閏 ladder chooses from.
 *
 * Note which term each candidate is built from: upstream rotates the 24-term
 * cycle to the *current* term and then reads its neighbours by index —
 * `[0]` is the current term, `[1]` the next, `[-1]` the previous — and the
 * "current" bureau is in fact built from `[0]`, the "超神接氣正授" one from
 * `[1]`, and "其他排局" from `[-1]`.
 */
function zhirunRawUncached(dt: CivilDateTime): ZhirunRaw {
  const jieqi = jieqiName(dt);
  const cycle = rotate(JIEQI_CYCLE, jieqi);
  const jqCurrent = cycle[0] as string;
  const jqNext = cycle[1] as string;
  const jqPrev = cycle[cycle.length - 1] as string;

  const dayPillar = pillars(dt).day;
  const sanyuan = sanyuanLabelOfDay(dayPillar);
  const yinyang = dunOf(jqCurrent);

  // 距節氣差日數: whole days between the term's moment and the query. Upstream
  // adds a day when the query is later the same day as the term.
  const start = currentJieqiStart(dt);
  const startDays = daysSinceEpoch(start.year, start.month, start.day);
  const nowDays = daysSinceEpoch(dt.year, dt.month, dt.day);
  const startMinutes = startDays * 1440 + start.hour * 60 + start.minute;
  const nowMinutes = nowDays * 1440 + dt.hour * 60 + dt.minute;
  const deltaMinutes = nowMinutes - startMinutes;
  // Python's timedelta normalises to a non-negative seconds part, so `.days`
  // floors and `.seconds` is the remainder — hence floor here, not truncate.
  let difference = Math.floor(deltaMinutes / 1440);
  const remainder = deltaMinutes - difference * 1440;
  if (remainder > 0 && difference === 0) difference += 1;

  const yuanIndex = must(YUAN_INDEX[sanyuan.replace("元", "")], "yuan index", { sanyuan });
  const juCurrent = jieqiJuCode(jqCurrent)[yuanIndex] as string;
  const juNext = jieqiJuCode(jqNext)[yuanIndex] as string;
  const juPrev = jieqiJuCode(jqPrev)[yuanIndex] as string;

  return {
    jieqi,
    daysFromJieqi: difference,
    sanyuan,
    zhifuStem: zhifuStem(dt),
    jieqiJu: jieqiJuCode(jqCurrent),
    yinyang,
    // 當前排局: this term's 遁 and this term's bureau.
    current: `${yinyang}${juCurrent}局`,
    // 超神接氣正授排局: the *next* term's 遁 and bureau — the chart you would be
    // on if the term had already arrived.
    chaoshen: `${dunOf(jqNext)}${juNext}局`,
    // 其他排局: this term's 遁 with the *previous* term's bureau.
    other: `${yinyang}${juPrev}局`,
    // 其他排局1: the next term's 遁 with *this* term's bureau.
    other1: `${dunOf(jqNext)}${juCurrent}局`,
  };
}

function daysSinceEpoch(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

/**
 * `config.qimen_ju_name_zhirun` — the special-case ladder.
 *
 * Read top to bottom; the first matching branch wins. Several branches pick the
 * same candidate on both sides of their condition; those are upstream's and are
 * kept verbatim so that a future upstream change stays a one-line diff.
 */
function juZhirunUncached(dt: CivilDateTime): string {
  const q = zhirunRaw(dt);
  const jq = q.jieqi;
  const d = q.daysFromJieqi;
  const lunar = lunarDate(dt.year, dt.month, dt.day);
  const lunarMonth = lunar.monthName;
  const solarMonth = lunar.month;
  const lunarDay = lunar.day;
  const isWuji = ["戊", "己", "庚", "辛", "壬", "癸"].includes(q.zhifuStem);
  const w = (candidate: string) => `${candidate}${q.sanyuan}`;
  const isWinterMonth = lunarMonth === "腊月" || lunarMonth === "冬月";

  // 芒種 window: 置閏 before 夏至.
  if (jq === "芒種" && d >= 1 && d <= 15) return w(q.current);
  // 大雪 window: the 陰遁 mirror, before 冬至.
  if (jq === "大雪" && d >= 1 && d <= 15) return w(q.other1);

  // The term's own day.
  if (d === 0) {
    if (isWinterMonth) return w(lunarMonth === "腊月" ? q.other1 : q.current);
    return w(solarMonth > 9 ? q.chaoshen : q.current);
  }

  // First day after the term.
  if (d === 1) return w(q.current);

  // 接氣 / 超神 transition.
  if (d >= 2 && d <= 6) {
    if (isWinterMonth) {
      return w(lunarMonth === "腊月" ? q.other1 : jq === "冬至" ? q.other : q.current);
    }
    if (solarMonth >= 9) {
      if (lunarDay < 15) return w(q.other1);
      return w(isWuji ? q.current : q.other);
    }
    if (lunarMonth === "正月") {
      if (lunarDay < 10 && !isWuji) return w(q.other);
      if (isWuji) {
        if (lunarDay < 20) return w(q.other1);
        if (lunarDay > 20 && lunarDay <= 26) return w(q.other);
        return w(q.other1);
      }
      return w(q.chaoshen);
    }
    if (solarMonth <= 6) {
      return w(lunarDay < 15 ? q.chaoshen : q.current);
    }
    return w(lunarDay < 15 ? q.current : q.other1);
  }

  // 中元 transition.
  if (d >= 7 && d <= 9) {
    if (isWinterMonth) return w(lunarMonth === "腊月" ? q.current : q.other1);
    if (lunarMonth === "正月") {
      return w((solarMonth <= 9 && lunarDay >= 15) || isWuji ? q.other1 : q.chaoshen);
    }
    if (solarMonth <= 6) {
      if (lunarDay <= 10) return w(q.other1);
      if (isWuji) return w(lunarDay < 20 ? q.chaoshen : q.other1);
      return w(q.current);
    }
    if (solarMonth <= 9) {
      if (lunarDay < 15) return w(q.chaoshen);
      return w(isWuji || lunarDay >= 20 ? q.other1 : q.current);
    }
    return w(q.chaoshen);
  }

  // 下元 / run-up to 置閏.
  if (d >= 10 && d <= 15) {
    if (isWinterMonth) {
      // Upstream's condition can only ever select 其他排局1 here; kept as-is.
      return w(lunarMonth === "腊月" || jq !== "冬至" ? q.other1 : d <= 12 ? q.other1 : q.current);
    }
    if (solarMonth > 9) return w(q.other1);
    if (lunarMonth === "正月") return w(q.current);
    return w(lunarDay < 15 ? q.current : q.other1);
  }

  // Everything else: 超神 when the query precedes the term, otherwise current.
  return w(d < 0 ? q.chaoshen : q.current);
}

/**
 * `config.qimen_ju_name_ke` — 刻家 bureaux. Far simpler: 陽遁 for a 子–巳 hour,
 * 陰遁 for 午–亥, and the bureau numbers do not vary by term at all.
 */
function juKeUncached(dt: CivilDateTime): string {
  const hourPillar = pillars(dt).hour;
  const yinyang = must(
    multiKeyGet(
      [
        [[..."子丑寅卯辰巳"], "陽遁"],
        [[..."午未申酉戌亥"], "陰遁"],
      ],
      hourPillar[1] as string
    ),
    "ke yin/yang dun",
    { hourPillar }
  );
  const code = yinyang === "陽遁" ? "一七四" : "九三六";
  const yuan = sanyuanOf(pillars(dt).hour);
  const i = must(YUAN_INDEX[yuan], "yuan index", { yuan });
  return `${yinyang}${code[i]}局${yuan}元`;
}

/** Parsed form of a bureau label, for callers that need the parts. */
export interface JuParts {
  /** 陽遁 or 陰遁 */
  dun: string;
  /** 1–9 */
  number: number;
  /** The Chinese numeral as it appears in the label. */
  numberChinese: string;
  /** 上 / 中 / 下 */
  yuan: string;
}

export function parseJu(label: string): JuParts {
  const dun = label.slice(0, 2);
  const numberChinese = label[2] as string;
  const number = CNUMBER.indexOf(numberChinese) + 1;
  const yuan = label.replace("元", "").slice(4);
  if (number < 1) {
    return must(undefined as JuParts | undefined, "bureau label", { label });
  }
  return { dun, number, numberChinese, yuan };
}

/** Whether the 置閏 label ends in a 元 suffix at all — used by the plate code. */
export function juBureauNumber(label: string): string {
  return label[2] as string;
}

export const juChaibu = memoize(dtKey, juChaibuUncached);
export const zhirunRaw = memoize(dtKey, zhirunRawUncached);
export const juZhirun = memoize(dtKey, juZhirunUncached);
export const juKe = memoize(dtKey, juKeUncached);
