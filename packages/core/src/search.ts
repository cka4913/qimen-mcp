/**
 * 找局 — scan forward or backward for 時辰 whose chart satisfies a set of
 * conditions.
 *
 * **The unit of matching is one palace of one 時辰, not the whole chart.** Every
 * condition must hold in the *same* palace; a chart where 生門 sits in 坎 and 丙
 * sits in 巽 does not match a `doors: ["生"], skyStems: ["丙"]` query. That is
 * what makes the tool useful for 擇時: you are looking for a place where the
 * pieces line up, not for a chart that happens to contain them somewhere.
 *
 * This semantic was not guessed. It was established empirically against a
 * separate commercial implementation (奇門實用版 v7.88) whose own outputs, over
 * three searches on one day, gave 12 / 2 / 22 hits — figures that are only
 * self-consistent under per-palace AND, per-palace OR, and the observation that
 * every chart contains all eight gates. The full protocol and data are in
 * `test-case/FINDINGS.md`.
 *
 * A note on why there is no `totalMatches`: the scan stops as soon as it has
 * `limit` matches, so it genuinely does not know how many more there are.
 * Reporting a number it did not count would be worse than reporting none.
 * `scannedThrough` is the cursor to resume from instead.
 */
import { EIGHT_GUA } from "./constants.js";
import { addDays, assertSupported, MAX_YEAR, MIN_YEAR, type CivilDateTime } from "./calendar.js";
import { hourBranch, pillars } from "./ganzhi.js";
import { juLabel, type Method } from "./zhifu.js";
import { panEarth, panSky } from "./plate.js";
import { panDoor, panGod, panStar } from "./stars-doors-gods.js";
import { patterns, type Patterns } from "./patterns.js";
import { QimenError } from "./errors.js";

/** A calendar date with no time of day. */
export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export type PatternName = keyof Patterns;

const PATTERN_NAMES: PatternName[] = ["greenDragon", "flyingBird", "jadeGirl"];

/**
 * The twelve 時辰 of a civil day, as the clock hour that represents each.
 *
 * 子時 spans 23:00–00:59, so it straddles midnight. Enumerating hour 0 covers
 * it exactly once per civil day and attributes it to the day it ends in —
 * which is also the day whose pillars it takes, since 23:00 already belongs to
 * the next day (晚子時). Hour 23 would produce the identical chart one day
 * early and is therefore skipped.
 */
const SHICHEN_HOURS = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

/** Conditions on a single palace. An omitted field is "any". */
export interface SearchCriteria {
  /** Restrict to these palaces. Omitted means any palace. */
  palaces?: string[];
  skyStems?: string[];
  earthStems?: string[];
  doors?: string[];
  stars?: string[];
  gods?: string[];
  /** Named configurations. The palace must be the one the pattern formed in. */
  patterns?: PatternName[];
}

export interface SearchOptions {
  /** Where the scan begins. */
  start: CivilDate;
  /** Far bound, inclusive. Must lie in the direction of travel. Optional. */
  end?: CivilDate;
  /** `backward` searches into the past — "when was the last time…". */
  direction?: "forward" | "backward";
  method: Method;
  /** Stop once this many matches are found. */
  limit?: number;
  /** Give up after scanning this many days, so an unsatisfiable query ends. */
  maxDays?: number;
}

/** What matched, and where. */
export interface SearchMatch {
  /** The representative moment of the 時辰. */
  datetime: CivilDateTime;
  /** 時辰 branch. Note 子時 begins at 23:00 the previous day. */
  branch: string;
  dayPillar: string;
  hourPillar: string;
  ju: string;
  /** The palace in which every condition held. */
  palace: string;
  /** The values that satisfied the query, for display without a second call. */
  matched: {
    skyStem?: string;
    earthStem?: string;
    door?: string;
    star?: string;
    god?: string;
    patterns?: PatternName[];
  };
}

export interface SearchResult {
  resolved: {
    start: CivilDate;
    end?: CivilDate;
    direction: "forward" | "backward";
    method: Method;
    criteria: SearchCriteria;
    limit: number;
    maxDays: number;
  };
  matches: SearchMatch[];
  returned: number;
  /** The scan stopped because it had enough; more may exist beyond the cursor. */
  limitReached: boolean;
  /** The scan stopped because it ran out of budget, not because it was done. */
  budgetExhausted: boolean;
  /** Last date examined. Pass as `start` to continue. */
  scannedThrough: CivilDate;
  /** How many 時辰 were examined (not palace-hour pairs). */
  scannedShichen: number;
}

export const SEARCH_DEFAULTS = {
  limit: 20,
  maxLimit: 200,
  maxDays: 1830,
  maxMaxDays: 3660,
} as const;

function nonEmpty(list: string[] | undefined): string[] | undefined {
  return list && list.length > 0 ? list : undefined;
}

/**
 * Reject queries that cannot match by construction, rather than returning an
 * empty result that looks like a real answer.
 */
function validate(criteria: SearchCriteria): void {
  const known = new Set(EIGHT_GUA);
  for (const p of criteria.palaces ?? []) {
    if (!known.has(p)) {
      throw new QimenError("UNKNOWN_REFERENCE_KEY", `${p} is not one of the nine palaces`, { palace: p });
    }
  }
  for (const p of criteria.patterns ?? []) {
    if (!PATTERN_NAMES.includes(p)) {
      throw new QimenError("UNKNOWN_REFERENCE_KEY", `${p} is not a known pattern`, { pattern: p });
    }
  }
  // 中宮 carries no gate, star or god, and drops off the sky plate when the
  // 值符 sits there. Asking for one of those *in* 中宮 can never match.
  const palaces = nonEmpty(criteria.palaces);
  const onlyCenter = palaces !== undefined && palaces.every((p) => p === "中");
  const wantsOuterOnly =
    nonEmpty(criteria.doors) !== undefined ||
    nonEmpty(criteria.stars) !== undefined ||
    nonEmpty(criteria.gods) !== undefined;
  if (onlyCenter && wantsOuterOnly) {
    throw new QimenError(
      "ARGUMENT_REQUIRED",
      "中宮 carries no 門, 星 or 神, so this combination can never match. Drop 中 from palaces, or drop the 門/星/神 condition.",
      { palaces, }
    );
  }
}

function toDate(d: CivilDate): CivilDate {
  return { year: d.year, month: d.month, day: d.day };
}

function compareDate(a: CivilDate, b: CivilDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Test one palace of one chart against the criteria. Returns what matched, or null. */
function matchPalace(
  palace: string,
  criteria: SearchCriteria,
  plates: {
    sky: Record<string, string>;
    earth: Record<string, string>;
    doors: Record<string, string>;
    stars: Record<string, string>;
    gods: Record<string, string>;
    patterns: Patterns;
  }
): SearchMatch["matched"] | null {
  const matched: SearchMatch["matched"] = {};

  const check = (
    wanted: string[] | undefined,
    actual: string | undefined,
    key: "skyStem" | "earthStem" | "door" | "star" | "god"
  ): boolean => {
    const list = nonEmpty(wanted);
    if (list === undefined) return true;
    if (actual === undefined || !list.includes(actual)) return false;
    matched[key] = actual;
    return true;
  };

  if (!check(criteria.skyStems, plates.sky[palace], "skyStem")) return null;
  if (!check(criteria.earthStems, plates.earth[palace], "earthStem")) return null;
  if (!check(criteria.doors, plates.doors[palace], "door")) return null;
  if (!check(criteria.stars, plates.stars[palace], "star")) return null;
  if (!check(criteria.gods, plates.gods[palace], "god")) return null;

  const wantedPatterns = criteria.patterns?.filter((p) => PATTERN_NAMES.includes(p)) ?? [];
  if (wantedPatterns.length > 0) {
    // Every named pattern must have formed in *this* palace. Two patterns can
    // rarely share a palace (青龍返首 is 戊 over 丙, 飛鳥跌穴 the reverse), so
    // asking for both is usually — and correctly — empty.
    for (const name of wantedPatterns) {
      if (plates.patterns[name].gong !== palace) return null;
    }
    matched.patterns = [...wantedPatterns];
  }

  return matched;
}

/**
 * Scan for 時辰 matching the criteria.
 *
 * Stops at `limit` matches or `maxDays` scanned, whichever comes first, and
 * reports which of the two ended it so the caller knows whether to resume.
 */
export function findChartTimes(criteria: SearchCriteria, options: SearchOptions): SearchResult {
  validate(criteria);

  const direction = options.direction ?? "forward";
  const step = direction === "forward" ? 1 : -1;
  const limit = Math.min(Math.max(options.limit ?? SEARCH_DEFAULTS.limit, 1), SEARCH_DEFAULTS.maxLimit);
  const maxDays = Math.min(Math.max(options.maxDays ?? SEARCH_DEFAULTS.maxDays, 1), SEARCH_DEFAULTS.maxMaxDays);
  const start = toDate(options.start);
  const end = options.end ? toDate(options.end) : undefined;

  assertSupported({ ...start, hour: 0, minute: 0 });
  if (end) {
    assertSupported({ ...end, hour: 0, minute: 0 });
    const ordered = direction === "forward" ? compareDate(end, start) >= 0 : compareDate(end, start) <= 0;
    if (!ordered) {
      throw new QimenError(
        "ARGUMENT_REQUIRED",
        `end must be ${direction === "forward" ? "on or after" : "on or before"} start when direction is ${direction}`,
        { start, end, direction }
      );
    }
  }

  // Which palaces to test. Restricting up front is the single biggest saving
  // on a scan, since most queries name one or two.
  const candidatePalaces = nonEmpty(criteria.palaces) ?? EIGHT_GUA;
  const needsPatterns = (criteria.patterns?.length ?? 0) > 0;

  const matches: SearchMatch[] = [];
  let cursor = start;
  let scannedDays = 0;
  let scannedShichen = 0;
  let limitReached = false;

  while (scannedDays < maxDays) {
    if (end && (direction === "forward" ? compareDate(cursor, end) > 0 : compareDate(cursor, end) < 0)) break;
    if (cursor.year < MIN_YEAR || cursor.year > MAX_YEAR) break;

    // Within a day the 時辰 run forwards; a backward scan visits days in
    // reverse but still reports each day's 時辰 in reverse, so results come
    // back in strict chronological order away from `start`.
    const hours = direction === "forward" ? SHICHEN_HOURS : [...SHICHEN_HOURS].reverse();
    for (const hour of hours) {
      const dt: CivilDateTime = { ...cursor, hour, minute: 0 };
      scannedShichen++;

      const plates = {
        sky: panSky(dt, options.method),
        earth: panEarth(dt, options.method),
        doors: panDoor(dt, options.method),
        stars: panStar(dt, options.method),
        gods: panGod(dt, options.method),
        patterns: needsPatterns
          ? patterns(dt, options.method)
          : ({ greenDragon: { gong: null }, flyingBird: { gong: null }, jadeGirl: { gong: null } } as Patterns),
      };

      for (const palace of candidatePalaces) {
        const matched = matchPalace(palace, criteria, plates);
        if (matched === null) continue;
        const gz = pillars(dt);
        matches.push({
          datetime: dt,
          branch: hourBranch(hour),
          dayPillar: gz.day,
          hourPillar: gz.hour,
          ju: juLabel(dt, options.method),
          palace,
          matched,
        });
        if (matches.length >= limit) {
          limitReached = true;
          break;
        }
      }
      if (limitReached) break;
    }
    if (limitReached) break;

    scannedDays++;
    cursor = addDays(cursor, step);
  }

  const resolved: SearchResult["resolved"] = {
    start,
    direction,
    method: options.method,
    criteria,
    limit,
    maxDays,
  };
  if (end) resolved.end = end;

  return {
    resolved,
    matches,
    returned: matches.length,
    limitReached,
    budgetExhausted: !limitReached && scannedDays >= maxDays,
    scannedThrough: cursor,
    scannedShichen,
  };
}
