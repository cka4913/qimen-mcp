/**
 * 九星, 八門, 八神 — all three are the same move: take the 值符's palace as the
 * anchor, walk the palaces in the bureau's rotation order, and lay the
 * sequence on them. Only the sequence and its direction differ.
 *
 * When the 值符 is in 中宮 all three anchor on 坤 instead (中寄坤).
 */
import { DOOR_R, STAR_R } from "./constants.js";
import type { CivilDateTime } from "./calendar.js";
import { juHead, juLabel, zhifuNZhishi, type Method } from "./zhifu.js";
import { rotate, zipRecord } from "./util.js";
import { rotationOrder } from "./plate.js";

function anchoredPalaces(dun: string, startingGong: string): string[] {
  const order = rotationOrder(dun);
  return rotate(order, startingGong === "中" ? "坤" : startingGong);
}

/** `config.pan_star` — trigram → star short name. */
export function panStar(dt: CivilDateTime, method: Method): Record<string, string> {
  const { dun } = juHead(juLabel(dt, method));
  const zz = zhifuNZhishi(dt, method);
  const startingStar = zz.zhifuStar[0].replace("芮", "禽");
  const sequence = dun === "陽" ? rotate(STAR_R, startingStar) : rotate([...STAR_R].reverse(), startingStar);
  return zipRecord(anchoredPalaces(dun, zz.zhifuStar[1]), sequence);
}

/** The same placement read backwards: star → trigram. */
export function panStarReverse(dt: CivilDateTime, method: Method): Record<string, string> {
  const forward = panStar(dt, method);
  const out: Record<string, string> = {};
  for (const [gong, star] of Object.entries(forward)) out[star] = gong;
  return out;
}

/** `config.pan_door` — trigram → gate. */
export function panDoor(dt: CivilDateTime, method: Method): Record<string, string> {
  const { dun } = juHead(juLabel(dt, method));
  const zz = zhifuNZhishi(dt, method);
  const startingDoor = zz.zhishiDoor[0];
  const sequence = dun === "陽" ? rotate(DOOR_R, startingDoor) : rotate([...DOOR_R].reverse(), startingDoor);
  return zipRecord(anchoredPalaces(dun, zz.zhishiDoor[1]), sequence);
}

/**
 * `config.pan_god` — trigram → god (one character each).
 *
 * 陽遁 and 陰遁 differ in two of the eight: 勾陳/朱雀 against 白虎/玄武.
 */
export function panGod(dt: CivilDateTime, method: Method): Record<string, string> {
  const { dun } = juHead(juLabel(dt, method));
  const zz = zhifuNZhishi(dt, method);
  const sequence = dun === "陽" ? [..."符蛇陰合勾雀地天"] : [..."符蛇陰合虎玄地天"];
  return zipRecord(anchoredPalaces(dun, zz.zhifuStar[1]), sequence);
}

/** Full names for the abbreviations the plates carry. */
export const GOD_FULL_NAMES: Record<string, string> = {
  符: "值符", 蛇: "螣蛇", 陰: "太陰", 合: "六合",
  勾: "勾陳", 雀: "朱雀", 虎: "白虎", 玄: "玄武",
  地: "九地", 天: "九天",
};

export const STAR_FULL_NAMES: Record<string, string> = {
  蓬: "天蓬", 任: "天任", 沖: "天沖", 輔: "天輔",
  英: "天英", 禽: "天禽", 柱: "天柱", 心: "天心", 芮: "天芮",
};

export const DOOR_FULL_NAMES: Record<string, string> = {
  休: "休門", 生: "生門", 傷: "傷門", 杜: "杜門",
  景: "景門", 死: "死門", 驚: "驚門", 開: "開門",
};
