/**
 * The assembled 時家奇門 chart — `Qimen.pan` in one canonical shape.
 *
 * Everything here is a pure function of the civil datetime and the school. The
 * engine never reads a clock, never applies a timezone and never applies 真太陽
 * 時: the moment you hand it is the moment it charts.
 */
import type { CivilDateTime } from "./calendar.js";
import { jieqiName, lunarDate, type LunarDate } from "./calendar.js";
import { pillars, xunHead, type Pillars } from "./ganzhi.js";
import { juLabel, tianyi, zhifuNZhishi, type Method, type ZhifuZhishi } from "./zhifu.js";
import { lodgedStem, panEarth, panSky, type LodgedStem } from "./plate.js";
import { panDoor, panGod, panStar } from "./stars-doors-gods.js";
import { dayHourKong, horses } from "./kong-horse.js";
import { palaceStages, type PalaceStage } from "./changsheng.js";
import { xunStem } from "./ganzhi.js";
import { must } from "./errors.js";
import { deepFreeze, multiKeyGet } from "./util.js";

export interface QimenChart {
  /** The inputs, echoed so a result is self-describing and cacheable. */
  resolved: { datetime: CivilDateTime; method: Method };
  /** 拆補 or 置閏, as a display string. */
  methodName: string;
  /** The five pillars. */
  pillars: Pillars;
  lunar: LunarDate;
  /** 旬首 stem of the day pillar (`config.shun`). */
  xunStem: string;
  /** 旬首 of the day and hour pillars. */
  xunHead: { day: string; hour: string };
  /** Void branches of the day and hour 旬. */
  kong: { day: string; hour: string };
  /** e.g. 甲己日 — which of the five day groups. */
  juDay: string;
  /** The bureau label, e.g. 陽遁六局上元. */
  ju: string;
  jieqi: string;
  zhifuZhishi: ZhifuZhishi;
  tianyi: string;
  /** trigram → stem. */
  skyPlate: Record<string, string>;
  /**
   * 中宮's stem and the palace it is read at. Separate from `skyPlate` because
   * it is not that palace's own stem — and because when the 值符 sits in 中宮,
   * `skyPlate` has only eight palaces and this is the only place the stem
   * appears at all. See PORTING-NOTES D12.
   */
  lodgedStem: LodgedStem;
  earthPlate: Record<string, string>;
  /** trigram → gate / star / god. */
  doors: Record<string, string>;
  stars: Record<string, string>;
  gods: Record<string, string>;
  horses: { tianMa: string; dingMa: string; yiMa: string };
  stages: { sky: Record<string, PalaceStage>; earth: Record<string, PalaceStage> };
}

/** `Qimen.qimen_ju_day` — which of the five day groups the day pillar is in. */
export function juDay(dt: CivilDateTime): string {
  const day = pillars(dt).day;
  const table: ReadonlyArray<readonly [readonly string[], string]> = [
    [[..."甲己"], "甲己日"],
    [[..."乙庚"], "乙庚日"],
    [[..."丙辛"], "丙辛日"],
    [[..."丁壬"], "丁壬日"],
    [[..."戊癸"], "戊癸日"],
  ];
  // Upstream looks the stem up first and falls back to the branch. The fallback
  // is unreachable — every stem is in the table — but is kept for fidelity.
  const byStem = multiKeyGet(table, day[0] as string);
  if (byStem !== undefined) return byStem;
  return must(multiKeyGet(table, day[1] as string), "ju day group", { day });
}

export const METHOD_NAMES: Record<Method, string> = { chaibu: "拆補", zhirun: "置閏" };

/**
 * Build the whole 時家 chart.
 *
 * The result is deep-frozen: its parts are shared with the memo caches, and a
 * caller that mutated one would change other callers' charts. Copy before
 * modifying.
 */
export function buildChart(dt: CivilDateTime, method: Method): QimenChart {
  const gz = pillars(dt);
  const kong = dayHourKong(dt);
  return deepFreeze({
    resolved: { datetime: { ...dt }, method },
    methodName: METHOD_NAMES[method],
    pillars: gz,
    lunar: lunarDate(dt.year, dt.month, dt.day),
    xunStem: xunStem(gz.day),
    xunHead: { day: xunHead(gz.day), hour: xunHead(gz.hour) },
    kong,
    juDay: juDay(dt),
    ju: juLabel(dt, method),
    jieqi: jieqiName(dt),
    zhifuZhishi: zhifuNZhishi(dt, method),
    tianyi: tianyi(dt, method),
    skyPlate: panSky(dt, method),
    lodgedStem: lodgedStem(dt, method),
    earthPlate: panEarth(dt, method),
    doors: panDoor(dt, method),
    stars: panStar(dt, method),
    gods: panGod(dt, method),
    horses: horses(dt),
    stages: palaceStages(dt, method),
  });
}
