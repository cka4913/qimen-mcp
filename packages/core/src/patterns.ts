/**
 * 格局 — named configurations, reported as facts.
 *
 * Each one is a statement about where two things landed: 青龍返首 is 丙 on the
 * earth plate sitting under 戊 on the sky plate, and so on. This module says
 * whether the configuration is present and in which palace. It says nothing
 * about whether that is good news — that is the reading agent's job.
 */
import type { CivilDateTime } from "./calendar.js";
import { pillars } from "./ganzhi.js";
import { panEarth, panSky } from "./plate.js";
import { zhifuNZhishi, type Method } from "./zhifu.js";
import { deepFreeze, invertRecord } from "./util.js";

export interface PatternResult {
  /** The palace the pattern formed in, or `null` if it did not form. */
  gong: string | null;
}

export interface Patterns {
  /** 青龍返首 — 戊 on the sky plate over 丙 on the earth plate. */
  greenDragon: PatternResult;
  /** 飛鳥跌穴 — 丙 on the sky plate over 戊 on the earth plate. */
  flyingBird: PatternResult;
  /** 玉女守門 — 丁 on the earth plate sharing the 值使門's palace. */
  jadeGirl: PatternResult;
}

/** `Qimen.green_dragon` */
export function greenDragon(dt: CivilDateTime, method: Method): PatternResult {
  const sky = invertRecord(panSky(dt, method));
  const earth = invertRecord(panEarth(dt, method));
  const zz = zhifuNZhishi(dt, method);
  const zhishiGong = earth[zz.zhifuStem[1]];
  const skyGong = sky["戊"];
  const earthGong = earth["丙"];

  if (skyGong !== undefined && earthGong !== undefined) {
    if (earthGong === skyGong) return { gong: skyGong };
    if (zhishiGong === earthGong) return { gong: earthGong };
    if (skyGong === "中") return { gong: earthGong };
    return { gong: null };
  }

  // 戊 or 丙 is missing from a plate — possible when the 值符 in 中宮 leaves the
  // sky plate eight-palace-wide. Upstream only answers when the hour stem is
  // one of the two, and returns nothing at all (a bare `None`) otherwise.
  const hourStem = pillars(dt).hour[0] as string;
  if (hourStem === "戊" || hourStem === "丙") {
    if (zhishiGong === "中") return { gong: zz.zhifuStar[1] };
    if (zz.zhifuStar[1] === "中") {
      const kunStem = panEarth(dt, method)["坤"] as string;
      return { gong: sky[kunStem] ?? null };
    }
    return { gong: null };
  }
  return { gong: null };
}

/** `Qimen.fly_bird` */
export function flyingBird(dt: CivilDateTime, method: Method): PatternResult {
  const sky = invertRecord(panSky(dt, method));
  const earth = invertRecord(panEarth(dt, method));
  const zz = zhifuNZhishi(dt, method);
  const zhishiGong = earth[zz.zhifuStem[1]];
  const earthGong = earth["戊"];
  const skyGong = sky["丙"];

  if (zhishiGong !== undefined && earthGong !== undefined && skyGong !== undefined) {
    if (earthGong === skyGong) return { gong: skyGong };
    if (skyGong === zhishiGong) return { gong: skyGong };
    return { gong: null };
  }
  if (zhishiGong === "中") return { gong: zz.zhifuStar[1] };
  return { gong: null };
}

/** `Qimen.jade_girl` */
export function jadeGirl(dt: CivilDateTime, method: Method): PatternResult {
  const earthGong = invertRecord(panEarth(dt, method))["丁"];
  if (earthGong === undefined) return { gong: null };
  const doorGong = zhifuNZhishi(dt, method).zhishiDoor[1];
  return { gong: doorGong === earthGong ? doorGong : null };
}

/** All three at once. */
export function patterns(dt: CivilDateTime, method: Method): Patterns {
  return deepFreeze({
    greenDragon: greenDragon(dt, method),
    flyingBird: flyingBird(dt, method),
    jadeGirl: jadeGirl(dt, method),
  });
}
