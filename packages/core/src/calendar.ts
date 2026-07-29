/**
 * Solar-term and lunar-calendar layer.
 *
 * Upstream (`jieqi.py`) gets all of this from `sxtwl`, a C++ extension. This
 * port uses `lunar-javascript`, whose ganzhi variants were matched to sxtwl's
 * empirically against the golden corpus:
 *
 *   sxtwl `getYearGZ()`  → `getYearInGanZhiByLiChun()`  (立春 boundary, day-granular)
 *   sxtwl `getMonthGZ()` → `getMonthInGanZhi()`         (節 boundary, day-granular)
 *   sxtwl `getDayGZ()`   → `getDayInGanZhi()`           (midnight boundary)
 *
 * The hour pillar is never taken from the library: upstream overwrites its stem
 * via 五鼠遁 and keeps only the branch, which is pure arithmetic on the hour.
 * See `ganzhi.ts`.
 */
import { Solar } from "lunar-javascript";
import { KinqimenError } from "./errors.js";
import { JIEQI_SXTWL_ORDER, LUNAR_MONTH_NAMES } from "./constants.js";
import { JIEQI_PACKED, JIEQI_TABLE_END_YEAR, JIEQI_TABLE_START_YEAR } from "./data/jieqi-table.js";
import { memoize } from "./util.js";

export interface CivilDateTime {
  /** Gregorian year. */
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** 0–23 */
  hour: number;
  /** 0–59 */
  minute: number;
}

export interface JieqiMoment {
  name: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface LunarDate {
  year: number;
  /** 1–12. A leap month reports its own number; use `isLeap` to tell them apart. */
  month: number;
  monthName: string;
  day: number;
  isLeap: boolean;
}

/**
 * The supported query span. The solar-term table runs wider than this on both
 * sides so that a query on the very first or last supported day can still look
 * backwards and forwards.
 */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

export function assertSupported(dt: CivilDateTime): void {
  if (!Number.isInteger(dt.year) || !Number.isInteger(dt.month) || !Number.isInteger(dt.day)) {
    throw new KinqimenError("DATETIME_INVALID", "year, month and day must be integers", { ...dt });
  }
  if (dt.month < 1 || dt.month > 12 || dt.day < 1 || dt.day > 31) {
    throw new KinqimenError("DATETIME_INVALID", "month must be 1–12 and day 1–31", { ...dt });
  }
  if (dt.hour < 0 || dt.hour > 23 || dt.minute < 0 || dt.minute > 59) {
    throw new KinqimenError("DATETIME_INVALID", "hour must be 0–23 and minute 0–59", { ...dt });
  }
  if (dt.year < MIN_YEAR || dt.year > MAX_YEAR) {
    throw new KinqimenError(
      "DATETIME_OUT_OF_RANGE",
      `year ${dt.year} is outside the supported range ${MIN_YEAR}–${MAX_YEAR}`,
      { ...dt }
    );
  }
}

/** Cache key for a civil moment. */
export function dtKey(dt: CivilDateTime): string {
  return `${dt.year}-${dt.month}-${dt.day}-${dt.hour}-${dt.minute}`;
}

/** Compare two civil moments as `datetime` does. */
export function compare(a: CivilDateTime, b: CivilDateTime): number {
  return (
    a.year - b.year || a.month - b.month || a.day - b.day || a.hour - b.hour || a.minute - b.minute
  );
}

/** Shift a calendar date by whole days, normalising month/year rollover. */
export function addDays(date: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
  d.setUTCFullYear(date.year); // years < 100 must not be mapped into the 1900s
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * The solar term falling on this exact solar day, or `null`.
 *
 * Upstream compares the term's *date* with the queried date and ignores the
 * time of day — a term at 23:58 still marks the whole day. That is deliberate
 * (the 置閏 day count is day-granular) and is preserved here.
 */
export function jieqiOnDay(year: number, month: number, day: number): JieqiMoment | null {
  const packed = JIEQI_PACKED[year - JIEQI_TABLE_START_YEAR];
  if (packed === undefined) {
    throw new KinqimenError(
      "DATETIME_OUT_OF_RANGE",
      `year ${year} is outside the solar-term table (${JIEQI_TABLE_START_YEAR}–${JIEQI_TABLE_END_YEAR})`,
      { year, month, day }
    );
  }
  for (let i = 0; i < 24; i++) {
    const at = i * 8;
    if (Number(packed.slice(at, at + 2)) !== month) continue;
    if (Number(packed.slice(at + 2, at + 4)) !== day) continue;
    return {
      name: JIEQI_SXTWL_ORDER[i] as string,
      year,
      month,
      day,
      hour: Number(packed.slice(at + 4, at + 6)),
      minute: Number(packed.slice(at + 6, at + 8)),
    };
  }
  return null;
}

/**
 * `jieqi.get_jieqi_start_date` — the solar term on this day, else walk back
 * day by day until one is found.
 */
function currentJieqiStartUncached(dt: CivilDateTime): JieqiMoment {
  let cursor = { year: dt.year, month: dt.month, day: dt.day };
  for (let i = 0; i < 40; i++) {
    const found = jieqiOnDay(cursor.year, cursor.month, cursor.day);
    if (found) return found;
    cursor = addDays(cursor, -1);
  }
  throw new KinqimenError("JIEQI_NOT_FOUND", "no solar term found within 40 days back", { ...dt });
}

/** `jieqi.get_next_jieqi_start_date` — search forward starting the day after. */
function nextJieqiStartUncached(dt: CivilDateTime): JieqiMoment {
  let cursor = addDays({ year: dt.year, month: dt.month, day: dt.day }, 1);
  for (let i = 0; i < 40; i++) {
    const found = jieqiOnDay(cursor.year, cursor.month, cursor.day);
    if (found) return found;
    cursor = addDays(cursor, 1);
  }
  throw new KinqimenError("JIEQI_NOT_FOUND", "no solar term found within 40 days forward", { ...dt });
}

/**
 * `jieqi.get_before_jieqi_start_date` — jump back 15 days first, then walk
 * back. Because terms are ~15 days apart this lands on the term *before* the
 * current one; the 15-day jump is upstream's, not an optimisation.
 */
function beforeJieqiStartUncached(dt: CivilDateTime): JieqiMoment {
  let cursor = addDays({ year: dt.year, month: dt.month, day: dt.day }, -15);
  for (let i = 0; i < 40; i++) {
    const found = jieqiOnDay(cursor.year, cursor.month, cursor.day);
    if (found) return found;
    cursor = addDays(cursor, -1);
  }
  throw new KinqimenError("JIEQI_NOT_FOUND", "no solar term found within 40 days back", { ...dt });
}

/**
 * `jieqi.jq` — the solar term period the moment falls in.
 *
 * `currentJieqiStart` is day-granular, so on a term day *before* the term's own
 * moment it returns a term that has not started yet; that case falls through to
 * the previous term.
 */
function jieqiNameUncached(dt: CivilDateTime): string {
  const start = currentJieqiStart(dt);
  const next = nextJieqiStart(dt);
  if (compare(start, dt) <= 0 && compare(dt, next) < 0) return start.name;
  if (compare(dt, start) < 0) return beforeJieqiStart(dt).name;
  throw new KinqimenError("JIEQI_NOT_FOUND", "moment is not inside any solar-term period", { ...dt });
}

/** `jieqi.lunar_date_d` */
export function lunarDate(year: number, month: number, day: number): LunarDate {
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  // `lunar-javascript` signs leap months negative; sxtwl (and therefore every
  // upstream table keyed on the month number) reports them unsigned.
  const m = lunar.getMonth();
  return {
    year: lunar.getYear(),
    month: Math.abs(m),
    monthName: LUNAR_MONTH_NAMES[Math.abs(m)] as string,
    day: lunar.getDay(),
    isLeap: m < 0,
  };
}

export const currentJieqiStart = memoize(dtKey, currentJieqiStartUncached);
export const nextJieqiStart = memoize(dtKey, nextJieqiStartUncached);
export const beforeJieqiStart = memoize(dtKey, beforeJieqiStartUncached);
export const jieqiName = memoize(dtKey, jieqiNameUncached);
