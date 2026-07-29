/**
 * 刻家奇門 — the minute-level chart.
 *
 * Structurally the same as 時家 but driven by the 刻柱 (a ten-minute
 * subdivision) instead of the hour pillar, and with its own tables throughout:
 * the bureau does not vary by solar term, the 值符/值使 come from six fixed
 * six-by-six tables rather than from the rotating strings, and the sky plate is
 * a lookup rather than a rotation.
 *
 * Two differences from 時家 are easy to miss and are load-bearing:
 *
 *  - 陰遁 walks the *reverse* of the clockwise order here, not the separate
 *    `YIN_EIGHTGUA_ORDER` the hour chart uses under 置閏.
 *  - 天乙 and the three 馬星 are still taken from the *hour* chart; the 刻 chart
 *    does not recompute them.
 */
import { CLOCKWISE_EIGHTGUA, CNUMBER, DOOR_R, EARTH_STEM_ORDER, EIGHT_GUA, JIAZI, STAR_R, XUN_HEAD_STEM } from "./constants.js";
import { dtKey, jieqiName, lunarDate, type CivilDateTime, type LunarDate } from "./calendar.js";
import { pillars, xunHead, xunStem, type Pillars } from "./ganzhi.js";
import { juKe } from "./ju.js";
import { chunk, deepFreeze, invertRecord, memoize, rotate, zipRecord } from "./util.js";
import { KinqimenError, must } from "./errors.js";
import { hourKeKong, horses } from "./kong-horse.js";
import { juDay, METHOD_NAMES } from "./chart.js";
import { tianyi, type Method, type ZhifuZhishi } from "./zhifu.js";
import { ANGAN } from "./data/angan.js";
import { KE_KOOK_GROUPS, KE_SKY_OVERRIDES, KE_SKY_PLATE_INDEX, KE_SKY_PLATES } from "./data/ke-sky-plate.js";

/** The six 局 the 刻家 tables are keyed by, in table order. */
const KE_KOOKS = ["陽一", "陽四", "陽七", "陰九", "陰六", "陰三"];
/** The six 甲-headed 旬, in table order. */
const LIUJIA = ["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"];
/** The six 儀, in the order the fallback index tables use. */
const LIUYI = [..."戊己庚辛壬癸"];

/** 值符星 per 局 per 旬. */
const KE_ZHIFU_STARS = [
  [..."蓬芮沖輔禽心"],
  [..."輔禽心柱任英"],
  [..."柱任英蓬芮沖"],
  [..."英任柱心禽輔"],
  [..."心禽輔沖芮蓬"],
  [..."沖芮蓬英任柱"],
];

/** 值使門 and its palace per 局 per 旬, each entry "門宮". */
const KE_ZHISHI_DOORS = [
  chunk("休坎死坤傷震杜巽死中開乾", 2),
  chunk("杜巽死中開乾驚兌生艮景離", 2),
  chunk("驚兌生艮景離休坎死坤傷震", 2),
  chunk("景離生艮驚兌開乾死中杜巽", 2),
  chunk("開乾死中杜巽傷震死坤休坎", 2),
  chunk("傷震死坤休坎景離生艮驚兌", 2),
];

/** `局` as the 刻家 tables key it — 陰/陽 plus the bureau numeral. */
export function keKookKey(dt: CivilDateTime): string {
  const label = juKe(dt);
  return `${label[0]}${label[2]}`;
}

/** Rotation order for the 刻 plates. Unlike 時家, 陰遁 is simply the reverse. */
function keRotation(dun: string): string[] {
  return dun === "陽" ? [...CLOCKWISE_EIGHTGUA] : [...CLOCKWISE_EIGHTGUA].reverse();
}

/** `config.pan_earth_minute` — trigram → stem. */
function panEarthKeUncached(dt: CivilDateTime): Record<string, string> {
  const label = juKe(dt);
  const byNumber = zipRecord(CNUMBER, EIGHT_GUA);
  const palaces = rotate(CNUMBER, label[2] as string).map((n) => must(byNumber[n], "palace for number", { n }));
  return zipRecord(palaces, must(EARTH_STEM_ORDER[label.slice(0, 2)], "earth stem order", { label }));
}

export const panEarthKe = memoize(dtKey, panEarthKeUncached);

/** `config.zhifu_n_zhishi_ke` */
function zhifuNZhishiKeUncached(dt: CivilDateTime): ZhifuZhishi {
  const gz = pillars(dt);
  const kook = keKookKey(dt);
  const kookIndex = KE_KOOKS.indexOf(kook);
  const xun = xunHead(gz.ke);
  const xunIndex = LIUJIA.indexOf(xun);
  if (kookIndex < 0 || xunIndex < 0) {
    return must(undefined as ZhifuZhishi | undefined, "ke zhifu table entry", { kook, xun });
  }

  const stem = must(XUN_HEAD_STEM[xun], "xun head stem", { xun });
  const star = must(KE_ZHIFU_STARS[kookIndex]?.[xunIndex], "ke zhifu star", { kook, xun });
  const doorEntry = must(KE_ZHISHI_DOORS[kookIndex]?.[xunIndex], "ke zhishi door", { kook, xun });
  const door = doorEntry[0] as string;
  const doorHomeGong = doorEntry[1] as string;

  // The 值符's palace is where the 刻柱's own stem sits on the earth plate; if
  // that stem is not on the plate (it is the 甲 the 旬 hides), the 旬's 遁甲 stem
  // stands in for it.
  const earthReverse = invertRecord(panEarthKe(dt));
  const fuGong = earthReverse[gz.ke[0] as string] ?? must(earthReverse[stem], "ke zhifu palace", { stem });

  // The gate advances one palace per 刻 from its home palace, over the sixteen
  // 刻 of the 旬 — upstream cycles the nine palaces across a 16-long window.
  const window = rotate(JIAZI, xun).slice(0, 16);
  const order = kook[0] === "陽" ? rotate(EIGHT_GUA, doorHomeGong) : rotate([...EIGHT_GUA].reverse(), doorHomeGong);
  const doorGong = must(window.map((_, i) => order[i % order.length])[window.indexOf(gz.ke)], "ke zhishi palace", {
    ke: gz.ke,
  }) as string;

  return { zhifuStem: [xun, stem], zhifuStar: [star, fuGong], zhishiDoor: [door, doorGong] };
}

export const zhifuNZhishiKe = memoize(dtKey, zhifuNZhishiKeUncached);

/**
 * `config.pan_sky_minute` — trigram → stem.
 *
 * Upstream computes the plate from a per-bureau table indexed by the 值符's
 * stem and palace, then overrides 360 specific 局+刻柱 combinations outright.
 * Both halves are data (see `data/ke-sky-plate.ts`); this is only the lookup.
 */
function panSkyKeUncached(dt: CivilDateTime): Record<string, string> {
  const gz = pillars(dt);
  const kook = keKookKey(dt);

  const override = KE_SKY_OVERRIDES[`${kook}${gz.ke}`];
  if (override !== undefined) return zipRecord(EIGHT_GUA, [...override]);

  const groupIndex = KE_KOOK_GROUPS.findIndex((group) => group.includes(kook));
  if (groupIndex < 0) {
    return must(undefined as Record<string, string> | undefined, "ke sky plate group", { kook });
  }
  const zz = zhifuNZhishiKe(dt);
  const stemRow = must(
    KE_SKY_PLATE_INDEX[groupIndex]?.[LIUYI.indexOf(zz.zhifuStem[1])],
    "ke sky plate row",
    { kook, stem: zz.zhifuStem[1] }
  );
  const plateIndex = must(zipRecord(EIGHT_GUA, stemRow)[zz.zhifuStar[1]], "ke sky plate index", {
    gong: zz.zhifuStar[1],
  });
  const plate = must(KE_SKY_PLATES[groupIndex]?.[plateIndex], "ke sky plate", { kook, plateIndex });
  return zipRecord(EIGHT_GUA, [...plate]);
}

export const panSkyKe = memoize(dtKey, panSkyKeUncached);

function keAnchoredPalaces(dun: string, startingGong: string): string[] {
  return rotate(keRotation(dun), startingGong === "中" ? "坤" : startingGong);
}

/** `config.pan_star_minute` */
export function panStarKe(dt: CivilDateTime): Record<string, string> {
  const dun = keKookKey(dt)[0] as string;
  const zz = zhifuNZhishiKe(dt);
  const start = zz.zhifuStar[0].replace("芮", "禽");
  const sequence = dun === "陽" ? rotate(STAR_R, start) : rotate([...STAR_R].reverse(), start);
  return zipRecord(keAnchoredPalaces(dun, zz.zhifuStar[1]), sequence);
}

/** `config.pan_door_minute` */
export function panDoorKe(dt: CivilDateTime): Record<string, string> {
  const dun = keKookKey(dt)[0] as string;
  const zz = zhifuNZhishiKe(dt);
  const sequence = dun === "陽" ? rotate(DOOR_R, zz.zhishiDoor[0]) : rotate([...DOOR_R].reverse(), zz.zhishiDoor[0]);
  return zipRecord(keAnchoredPalaces(dun, zz.zhishiDoor[1]), sequence);
}

/** `config.pan_god_minute` */
export function panGodKe(dt: CivilDateTime): Record<string, string> {
  const dun = keKookKey(dt)[0] as string;
  const zz = zhifuNZhishiKe(dt);
  const sequence = dun === "陽" ? [..."符蛇陰合勾雀地天"] : [..."符蛇陰合虎玄地天"];
  return zipRecord(keAnchoredPalaces(dun, zz.zhifuStar[1]), sequence);
}

export interface AnganResult {
  /** 干支 → trigram. Upstream keys this by the 干支, not by the palace. */
  hidden: Record<string, string>;
  /** 飛干 — the tenth entry of the row, a stem plus a trigram. */
  flying: string;
}

/** `Qimen.pan_minute`'s 暗干 / 飛干 lookup. */
export function angan(dt: CivilDateTime): AnganResult {
  const key = `${keKookKey(dt)}${pillars(dt).ke}`;
  const row = ANGAN[key];
  if (row === undefined) {
    throw new KinqimenError("ANGAN_NOT_FOUND", `no 暗干 row for ${key}`, { key });
  }
  return {
    hidden: zipRecord(row.slice(0, -1), EIGHT_GUA),
    flying: must(row[row.length - 1], "flying stem", { key }),
  };
}

export interface KeChart {
  resolved: { datetime: CivilDateTime; method: Method };
  methodName: string;
  pillars: Pillars;
  lunar: LunarDate;
  /** 旬首 stem of the *hour* pillar — upstream's choice, not the 刻 pillar's. */
  xunStem: string;
  xunHead: { hour: string; ke: string };
  /** Void branches of the hour and 刻 旬. */
  kong: { hour: string; ke: string };
  juDay: string;
  /** The 刻家 bureau label, e.g. 陽一局上元. */
  ju: string;
  jieqi: string;
  zhifuZhishi: ZhifuZhishi;
  /** Taken from the hour chart, which is why the school still matters here. */
  tianyi: string;
  skyPlate: Record<string, string>;
  earthPlate: Record<string, string>;
  doors: Record<string, string>;
  stars: Record<string, string>;
  gods: Record<string, string>;
  horses: { tianMa: string; dingMa: string; yiMa: string };
  angan: AnganResult;
}

/** Build the whole 刻家 chart. Deep-frozen, like every engine result. */
export function buildKeChart(dt: CivilDateTime, method: Method): KeChart {
  const gz = pillars(dt);
  return deepFreeze({
    resolved: { datetime: { ...dt }, method },
    methodName: METHOD_NAMES[method],
    pillars: gz,
    lunar: lunarDate(dt.year, dt.month, dt.day),
    xunStem: xunStem(gz.hour),
    xunHead: { hour: xunHead(gz.hour), ke: xunHead(gz.ke) },
    kong: hourKeKong(dt),
    juDay: juDay(dt),
    ju: juKe(dt),
    jieqi: jieqiName(dt),
    zhifuZhishi: zhifuNZhishiKe(dt),
    tianyi: tianyi(dt, method),
    skyPlate: panSkyKe(dt),
    earthPlate: panEarthKe(dt),
    doors: panDoorKe(dt),
    stars: panStarKe(dt),
    gods: panGodKe(dt),
    horses: horses(dt),
    angan: angan(dt),
  });
}
