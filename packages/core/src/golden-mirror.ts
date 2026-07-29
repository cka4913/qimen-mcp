/**
 * 金函玉鏡 — the daily 日家奇門 chart.
 *
 * Independent of the hour and 刻 charts: it needs only the day pillar and
 * whether the date falls in the 冬至 or 夏至 half of the year. Nine 金函 stars,
 * eight gates, one 神, and 鶴神.
 */
import { CLOCKWISE_EIGHTGUA, DI_ZHI, DOOR_R, EIGHT_GUA, GOLDEN_STARS, JIAZI, JIEQI_CYCLE, TIAN_GAN } from "./constants.js";
import { dtKey, jieqiName, type CivilDateTime } from "./calendar.js";
import { pillars } from "./ganzhi.js";
import { chunk, memoize, multiKeyGet, rotate, splitList, zipRecord } from "./util.js";
import { must } from "./errors.js";

/** Which half of the year the date sits in — 冬至 for 陽遁, 夏至 for 陰遁. */
function halfOfYear(jieqi: string): string {
  const table: ReadonlyArray<readonly [readonly string[], string]> = [
    [rotate(JIEQI_CYCLE, "冬至").slice(0, 12), "冬至"],
    [rotate(JIEQI_CYCLE, "夏至").slice(0, 12), "夏至"],
  ];
  return must(multiKeyGet(table, jieqi), "half of year", { jieqi });
}

/** The palace the 天乙 (first 金函 star) starts on, cycled over the sixty days. */
const TIANYI_START: Record<string, string[]> = {
  冬至: [..."艮離坎坤震巽中乾兌"],
  夏至: [..."坤坎離艮兌乾中巽震"],
};

/** The palace the 休門 starts on, one step per three days. */
const REST_DOOR_ORDER = [..."坎坤震巽乾兌艮離"];

export interface GoldenMirrorChart {
  resolved: { datetime: CivilDateTime };
  /** e.g. 陽遁甲子日 */
  ju: string;
  dun: string;
  dayPillar: string;
  jieqi: string;
  /**
   * 鶴神 — the direction to avoid on this day.
   *
   * Upstream's table only ever covers the first eight day pillars of a
   * 庚申-anchored cycle and returns a repeated-character list rather than a
   * direction, so most days get `null`. Reproduced as-is; see
   * docs/PORTING-NOTES.md.
   */
  craneGod: string[] | null;
  /** trigram → 金函 star (two characters). */
  stars: Record<string, string>;
  /** trigram → gate. 中 carries an empty string, as upstream emits it. */
  doors: Record<string, string>;
  /** branch → 神, for the day stem. */
  gods: Record<string, string>;
}

/** `Qimen.crane_god` */
function craneGod(dayPillar: string): string[] | null {
  const directions = [..."巽離坤兌乾坎天艮震"];
  const runs = [6, 5, 6, 5, 6, 5, 16, 6, 5];
  // `range(0, 8)` upstream, so the ninth direction is never emitted, and the
  // runs are used as repeat counts on a single key rather than being laid out
  // across consecutive days. Both are upstream's.
  const values = Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: runs[i] as number }, () => directions[i] as string)
  );
  const keys = rotate(JIAZI, "庚申");
  const index = keys.indexOf(dayPillar);
  return index >= 0 && index < values.length ? (values[index] as string[]) : null;
}

/** `config.getgtw` — day stem → (branch → 神). */
export function getgtw(): Record<string, Record<string, string>> {
  const all = chunk("地籥六賊五符天曹地符風伯雷公雨師風雲唐符國印天關", 2);
  const heads = chunk("地籥天關唐符風雲唐符風雲雷公風伯天曹五符", 2);
  const perStem = heads.map((head) => zipRecord(DI_ZHI, rotate(all, head)));
  return zipRecord(TIAN_GAN, perStem);
}

function goldenMirrorUncached(dt: CivilDateTime): GoldenMirrorChart {
  const jieqi = jieqiName(dt);
  const half = halfOfYear(jieqi);
  const dayPillar = pillars(dt).day;
  const dun = half === "冬至" ? "陽遁" : "陰遁";

  // 金函 stars: find where 天乙 starts today, then lay the nine stars from there.
  const starts = must(TIANYI_START[half], "tianyi start cycle", { half });
  const startGong = must(
    zipRecord(JIAZI, JIAZI.map((_, i) => starts[i % starts.length] as string))[dayPillar],
    "tianyi start palace",
    { dayPillar }
  );
  const walk = dun === "陽遁" ? EIGHT_GUA : [...EIGHT_GUA].reverse();
  const stars = zipRecord(rotate(walk, startGong), GOLDEN_STARS);

  // Gates: the 休門 palace advances one step every three days.
  const triples = splitList(JIAZI, 3);
  const restOrder = dun === "陽遁" ? REST_DOOR_ORDER : [...REST_DOOR_ORDER].reverse();
  const restTable = triples.map((group, i) => [group, restOrder[i % restOrder.length] as string] as const);
  const rest = must(multiKeyGet(restTable, dayPillar), "rest door palace", { dayPillar });
  const clockwise = dun === "陽遁" ? [...CLOCKWISE_EIGHTGUA] : [...CLOCKWISE_EIGHTGUA].reverse();
  const doors = { ...zipRecord(rotate(clockwise, rest), DOOR_R), 中: "" };

  return {
    resolved: { datetime: { ...dt } },
    ju: `${dun}${dayPillar}日`,
    dun,
    dayPillar,
    jieqi,
    craneGod: craneGod(dayPillar),
    stars,
    doors,
    gods: must(getgtw()[dayPillar[0] as string], "gtw for day stem", { dayPillar }),
  };
}

export const buildGoldenMirrorChart = memoize(dtKey, goldenMirrorUncached);
