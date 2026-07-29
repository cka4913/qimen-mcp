/**
 * 真人閉六戊法 — the 法術奇門 rite that walks 戊 around the six yang branches.
 *
 * Upstream computes this inside a Streamlit component that returns an SVG; only
 * the path logic is carried over here. The output is the sequence of branches
 * and their palaces, so the caller can draw, narrate or ignore it.
 *
 * Two transmissions disagree on the direction of travel, and both are in
 * circulation, so the version is an explicit argument rather than a default
 * buried in the code.
 */
import type { CivilDateTime } from "./calendar.js";
import { pillars, xunHead } from "./ganzhi.js";
import { must } from "./errors.js";

/** 演義版 walks anticlockwise (逆布連土); 寶鑑版 walks clockwise (順布連土). */
export type SixwuVersion = "yanyi" | "baojian";

export const SIXWU_VERSION_NAMES: Record<SixwuVersion, string> = {
  yanyi: "演義版",
  baojian: "寶鑑版",
};

/** 旬首 → the branch 戊 occupies. */
const SIXWU_POSITION: Record<string, string> = {
  甲子: "辰", 甲戌: "寅", 甲申: "子",
  甲午: "戌", 甲辰: "申", 甲寅: "午",
};

/** 遁甲 stem → its 旬首, for callers holding a stem rather than a pillar. */
export const STEM_TO_XUN: Record<string, string> = {
  戊: "甲子", 己: "甲戌", 庚: "甲申",
  辛: "甲午", 壬: "甲辰", 癸: "甲寅",
};

/** Branch → the palace it belongs to. */
const BRANCH_TO_GONG: Record<string, string> = {
  子: "坎", 丑: "艮", 寅: "艮", 卯: "震",
  辰: "巽", 巳: "巽", 午: "離", 未: "坤",
  申: "坤", 酉: "兌", 戌: "乾", 亥: "乾",
};

/** The six yang branches, clockwise. */
const YANG_BRANCHES = [..."子寅辰午申戌"];

export interface SixwuStep {
  /** 1-based position along the path; step 0 is where 戊 starts. */
  step: number;
  branch: string;
  gong: string;
}

export interface SixwuPath {
  xunHead: string;
  version: SixwuVersion;
  versionName: string;
  /** The branch 戊 sits on for this 旬. */
  wuBranch: string;
  /** Seven steps: the start plus one full circuit back to it. */
  path: SixwuStep[];
}

/** The 閉六戊 path for a 旬首 (`甲子`…`甲寅`). */
export function closedSixwuForXun(xun: string, version: SixwuVersion): SixwuPath {
  const wuBranch = must(SIXWU_POSITION[xun], "sixwu position", { xun });
  const start = YANG_BRANCHES.indexOf(wuBranch);
  const step = version === "yanyi" ? -1 : 1;
  const path = Array.from({ length: 7 }, (_, i) => {
    const branch = YANG_BRANCHES[(((start + step * i) % 6) + 6) % 6] as string;
    return { step: i, branch, gong: must(BRANCH_TO_GONG[branch], "gong for branch", { branch }) };
  });
  return { xunHead: xun, version, versionName: SIXWU_VERSION_NAMES[version], wuBranch, path };
}

/** The 閉六戊 path for a moment, taken from the hour pillar's 旬. */
export function closedSixwu(dt: CivilDateTime, version: SixwuVersion): SixwuPath {
  return closedSixwuForXun(xunHead(pillars(dt).hour), version);
}
