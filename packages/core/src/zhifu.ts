/**
 * 值符 (the duty star) and 值使 (the duty gate).
 *
 * Upstream encodes both as strings: for each of the six 甲-headed 旬 it builds a
 * short string whose first character is the palace number the 旬 starts on and
 * whose remaining characters are the palace number for each of the ten stems in
 * turn. Reading the hour stem's index off that string gives the palace. The
 * string encoding is kept — it *is* the algorithm — but it is built here in
 * named steps rather than as one nested comprehension.
 */
import { CNUMBER, EIGHT_GUA, JIAZI, TIAN_GAN, XUN_HEAD_STEM } from "./constants.js";
import { dtKey, type CivilDateTime } from "./calendar.js";
import { pillars, xunHead } from "./ganzhi.js";
import { juChaibu, juZhirun } from "./ju.js";
import { memoize, rotate, rotateReverse, zipRecord } from "./util.js";
import { must } from "./errors.js";

/** Which 排局 school a chart is built with. */
export type Method = "chaibu" | "zhirun";

/** The bureau label for a moment under the chosen school. */
export function juLabel(dt: CivilDateTime, method: Method): string {
  return method === "chaibu" ? juChaibu(dt) : juZhirun(dt);
}

/** The 陽 / 陰 character and the bureau numeral, as the plate code reads them. */
export function juHead(label: string): { dun: string; kook: string } {
  return { dun: label[0] as string, kook: label[2] as string };
}

/**
 * 值符 palace sequence per bureau. Each entry maps the ten stems to palace
 * numbers; the ladder is upstream's `zhifu_pai` table verbatim.
 */
const ZHIFU_SEQUENCE: Record<string, Record<string, string>> = {
  陽: {
    一: "九八七一二三四五六",
    二: "一九八二三四五六七",
    三: "二一九三四五六七八",
    四: "三二一四五六七八九",
    五: "四三二五六七八九一",
    六: "五四三六七八九一二",
    七: "六五四七八九一二三",
    八: "七六五八九一二三四",
    九: "八七六九一二三四五",
  },
  陰: {
    九: "一二三九八七六五四",
    八: "九一二八七六五四三",
    七: "八九一七六五四三二",
    六: "七八九六五四三二一",
    五: "六七八五四三二一九",
    四: "五六七四三二一九八",
    三: "四五六三二一九八七",
    二: "三四五二一九八七六",
    一: "二三四一九八七六五",
  },
};

const XUN_HEADS = JIAZI.filter((_, i) => i % 10 === 0);

/** `config.zhifu_pai` — 旬 → "start-palace + ten stem palaces". */
function zhifuPaiUncached(dt: CivilDateTime, method: Method): Record<string, string> {
  const { dun, kook } = juHead(juLabel(dt, method));
  const sequence = must(ZHIFU_SEQUENCE[dun]?.[kook], "zhifu sequence", { dun, kook });
  const starts = dun === "陰" ? rotateReverse(CNUMBER, kook) : rotate(CNUMBER, kook);
  return zipRecord(XUN_HEADS, starts.slice(0, 6).map((n) => n + sequence));
}

/**
 * `config.zhishi_pai` — same shape, but the palace sequence is simply the nine
 * palaces walked in bureau order and wrapped, so each 旬 reads its own window.
 */
function zhishiPaiUncached(dt: CivilDateTime, method: Method): Record<string, string> {
  const { dun, kook } = juHead(juLabel(dt, method));
  const order = dun === "陰" ? rotateReverse(CNUMBER, kook) : rotate(CNUMBER, kook);
  const tripled = order.join("").repeat(3);
  const values = order.slice(0, 6).map((n) => n + tripled.slice(tripled.indexOf(n) + 1).slice(0, 11));
  return zipRecord(XUN_HEADS, values);
}

/** Palace number (Chinese numeral) → trigram. */
const GONG_BY_NUMBER = zipRecord(CNUMBER, EIGHT_GUA);
/** Palace number → the gate that sits there natively. */
const DOOR_BY_NUMBER = zipRecord(CNUMBER, [..."休死傷杜中開驚生景"]);
/** Palace number → the star that sits there natively. */
const STAR_BY_NUMBER = zipRecord(CNUMBER, [..."蓬芮沖輔禽心柱任英"]);

export interface ZhifuZhishi {
  /** `[旬首, its 遁甲 stem]` */
  zhifuStem: [string, string];
  /** `[值符星, its palace]` */
  zhifuStar: [string, string];
  /** `[值使門, its palace]` */
  zhishiDoor: [string, string];
}

/** `config.zhifu_n_zhishi` */
function zhifuNZhishiUncached(dt: CivilDateTime, method: Method): ZhifuZhishi {
  const gz = pillars(dt);
  const hourStemIndex = TIAN_GAN.indexOf(gz.hour[0] as string);
  const xun = xunHead(gz.hour);

  const zhishi = zhishiPai(dt, method);
  const zhifu = zhifuPai(dt, method);

  const zhifuEntry = must(zhifu[xun], "zhifu entry", { xun });
  const zhishiEntry = must(zhishi[xun], "zhishi entry", { xun });

  const star = must(STAR_BY_NUMBER[zhifuEntry[0] as string], "zhifu star", { zhifuEntry });
  const starGong = must(GONG_BY_NUMBER[zhifuEntry[hourStemIndex] as string], "zhifu palace", { zhifuEntry });
  const doorGong = must(GONG_BY_NUMBER[zhishiEntry[hourStemIndex] as string], "zhishi palace", { zhishiEntry });

  let door = must(DOOR_BY_NUMBER[zhishiEntry[0] as string], "zhishi door", { zhishiEntry });
  // 中宮 has no gate of its own; upstream sends it to 死門 (寄坤).
  if (door === "中") door = "死";

  return {
    zhifuStem: [xun, must(XUN_HEAD_STEM[xun], "xun head stem", { xun })],
    zhifuStar: [star, starGong],
    zhishiDoor: [door, doorGong],
  };
}

const methodKey = (dt: CivilDateTime, method: Method): string => `${dtKey(dt)}|${method}`;

export const zhifuPai = memoize(methodKey, zhifuPaiUncached);
export const zhishiPai = memoize(methodKey, zhishiPaiUncached);
export const zhifuNZhishi = memoize(methodKey, zhifuNZhishiUncached);

/** `Qimen.tianyi` — the 天乙 star, named from the 值符's palace. */
export function tianyi(dt: CivilDateTime, method: Method): string {
  const gong = zhifuNZhishi(dt, method).zhifuStar[1];
  const byGua = zipRecord(EIGHT_GUA, [..."蓬芮沖輔禽心柱任英"]);
  // Upstream falls back to 禽 when the palace is missing from the table; with
  // 中 mapped in `EIGHT_GUA` that fallback maps to 禽 anyway.
  return byGua[gong] ?? "禽";
}
