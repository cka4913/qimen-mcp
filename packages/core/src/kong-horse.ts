/**
 * 旬空 (the void branches of a 旬) and the three 馬星.
 *
 * Upstream's 孤虛 table carries both the 孤 (void) and 虛 (opposed) pair for
 * each 旬 but only ever reads 孤; both are exposed here since the table is the
 * same size either way.
 */
import type { CivilDateTime } from "./calendar.js";
import { pillars, xunHead } from "./ganzhi.js";
import { chunk, multiKeyGet } from "./util.js";
import { must } from "./errors.js";

/** 旬 → its 孤 (void) and 虛 (opposed) branch pairs. */
export const GUXU: Record<string, { kong: string; xu: string }> = {
  甲子: { kong: "戌亥", xu: "辰巳" },
  甲戌: { kong: "申酉", xu: "寅卯" },
  甲申: { kong: "午未", xu: "子丑" },
  甲午: { kong: "辰巳", xu: "戌亥" },
  甲辰: { kong: "寅卯", xu: "申酉" },
  甲寅: { kong: "子丑", xu: "午未" },
};

function kongOf(pillar: string): string {
  return must(GUXU[xunHead(pillar)], "guxu entry", { pillar }).kong;
}

/** `config.daykong_shikong` — the void branches of the day and hour 旬. */
export function dayHourKong(dt: CivilDateTime): { day: string; hour: string } {
  const gz = pillars(dt);
  return { day: kongOf(gz.day), hour: kongOf(gz.hour) };
}

/**
 * `config.hourkong_minutekong` — the 刻家 pair. Upstream labels these 日空/時空
 * too, but they are the *hour* and *刻* voids; the names are corrected here and
 * the shift is noted in docs/PORTING-NOTES.md.
 */
export function hourKeKong(dt: CivilDateTime): { hour: string; ke: string } {
  const gz = pillars(dt);
  return { hour: kongOf(gz.hour), ke: kongOf(gz.ke) };
}

/** `Qimen.moonhorse` — 天馬, from the day branch. */
export function tianMa(dt: CivilDateTime): string {
  const branch = pillars(dt).day[1] as string;
  const table = chunk("寅申卯酉辰戌巳亥午子丑未", 2).map((pair) => [...pair] as readonly string[]);
  const values = [..."午申戌子寅辰"];
  return must(multiKeyGet(table.map((keys, i) => [keys, values[i] as string] as const), branch), "tian ma", { branch });
}

/** `Qimen.dinhorse` — 丁馬, from the day 旬. */
export function dingMa(dt: CivilDateTime): string {
  const xun = xunHead(pillars(dt).day);
  const table: Record<string, string> = { 甲子: "卯", 甲戌: "丑", 甲申: "亥", 甲午: "酉", 甲辰: "未", 甲寅: "巳" };
  return must(table[xun], "ding ma", { xun });
}

/** `Qimen.hourhorse` — 驛馬, from the hour branch's 三合 group. */
export function yiMa(dt: CivilDateTime): string {
  const branch = pillars(dt).hour[1] as string;
  const groups = chunk("申子辰寅午戌亥卯未巳酉丑", 3).map((g) => [...g] as readonly string[]);
  const values = [..."寅申巳亥"];
  return must(multiKeyGet(groups.map((keys, i) => [keys, values[i] as string] as const), branch), "yi ma", { branch });
}

/** All three 馬星 together. */
export function horses(dt: CivilDateTime): { tianMa: string; dingMa: string; yiMa: string } {
  return { tianMa: tianMa(dt), dingMa: dingMa(dt), yiMa: yiMa(dt) };
}
