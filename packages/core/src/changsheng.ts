/**
 * 十二長生 — the twelve-stage life cycle a stem passes through around the twelve
 * branches, read for each palace of the two plates.
 *
 * Yang stems run the cycle forwards from their 長生 branch; yin stems run it
 * backwards. Upstream then re-keys the branch→stage map into a stem→stage map
 * through a fixed branch→stem correspondence, which is what the plates are
 * actually looked up with.
 */
import { DI_ZHI, TIAN_GAN } from "./constants.js";
import type { CivilDateTime } from "./calendar.js";
import { pillars } from "./ganzhi.js";
import { chunk, rotate, zipRecord } from "./util.js";
import { must } from "./errors.js";
import { panEarth, panSky } from "./plate.js";
import type { Method } from "./zhifu.js";

const YANG_STAGES = [...chunk("長生沐浴冠帶臨冠帝旺", 2), ...[..."衰病死墓絕胎養"]];
const YIN_STAGES = [...[..."死病衰"], ...chunk("帝旺臨冠冠帶沐浴長生", 2), ...[..."養胎絕墓"]];

/** The branch each stem's cycle is anchored on, in stem-pair order. */
const ANCHORS = [..."亥寅寅巳申"];

/** `config.find_shier_luck` — branch → stage, for one stem. */
export function twelveStages(stem: string): Record<string, string> {
  const yangIndex = TIAN_GAN.filter((_, i) => i % 2 === 0).indexOf(stem);
  if (yangIndex >= 0) {
    return zipRecord(rotate(DI_ZHI, must(ANCHORS[yangIndex], "anchor", { stem })), YANG_STAGES);
  }
  const yinIndex = TIAN_GAN.filter((_, i) => i % 2 === 1).indexOf(stem);
  if (yinIndex >= 0) {
    return zipRecord(rotate(DI_ZHI, must(ANCHORS[yinIndex], "anchor", { stem })), YIN_STAGES);
  }
  return must(undefined as Record<string, string> | undefined, "twelve stages", { stem });
}

/**
 * Branch → the stem that stands for it when the stage table is re-keyed.
 *
 * 丑 and 未 both map to 己, and 辰 and 戌 both map to 戊, so two of the ten stems
 * are written twice and the later write wins. "Later" means later in the *stage
 * table's* own order, which starts at the stem's 長生 branch — so which of 辰/戌
 * decides 戊's stage depends on the stem being charted. Iterating the branches
 * in their natural order instead would silently change every 戊 and 己 palace.
 */
const BRANCH_AS_STEM = zipRecord(DI_ZHI, [..."癸己甲乙戊丙丁己庚辛戊壬"]);

/** Stem → stage for the day stem's cycle, as the plates are read with. */
export function stageByStem(dayStem: string): Record<string, string> {
  const byBranch = twelveStages(dayStem);
  const out: Record<string, string> = {};
  // Object key order here is the rotated branch order built by `twelveStages`.
  for (const [branch, stage] of Object.entries(byBranch)) {
    out[must(BRANCH_AS_STEM[branch], "branch as stem", { branch })] = stage;
  }
  return out;
}

export interface PalaceStage {
  /** The stem sitting in that palace. */
  stem: string;
  /** Its 長生 stage under the day stem's cycle. */
  stage: string;
}

/** `Qimen.gong_chengsun` — the stage of every palace on both plates. */
export function palaceStages(
  dt: CivilDateTime,
  method: Method
): { sky: Record<string, PalaceStage>; earth: Record<string, PalaceStage> } {
  const table = stageByStem(pillars(dt).day[0] as string);
  const map = (plate: Record<string, string>): Record<string, PalaceStage> => {
    const out: Record<string, PalaceStage> = {};
    for (const [gong, stem] of Object.entries(plate)) {
      out[gong] = { stem, stage: must(table[stem], "stage for stem", { stem }) };
    }
    return out;
  };
  return { sky: map(panSky(dt, method)), earth: map(panEarth(dt, method)) };
}
