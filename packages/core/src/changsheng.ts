/**
 * 十二長生 — the twelve-stage life cycle a stem passes through around the twelve
 * branches, read for each palace of the two plates.
 *
 * Yang stems run the cycle forwards from their 長生 branch; yin stems run it
 * backwards. A palace's stem is then read at that palace's own branch.
 *
 * **The four corner palaces cover two branches each**, and a stem can be at two
 * different stages across them — 辛 in 巽 is 墓 at 辰 and 死 at 巳, and both are
 * true. So a palace does not have *a* stage; it has one per branch it covers.
 * That is why `PalaceStage` carries a list rather than a single label: picking
 * one of the two would be inventing an answer.
 *
 * Upstream computes something else entirely — it takes the *day stem's* cycle
 * and re-keys it through a branch-to-stem table, so a palace's stage does not
 * depend on that palace at all. See docs/PORTING-NOTES.md D11.
 */
import { DI_ZHI, TIAN_GAN } from "./constants.js";
import type { CivilDateTime } from "./calendar.js";
import { chunk, rotate, zipRecord } from "./util.js";
import { must } from "./errors.js";
import { panEarth, panSky } from "./plate.js";
import type { Method } from "./zhifu.js";

const YANG_STAGES = [...chunk("長生沐浴冠帶臨冠帝旺", 2), ...[..."衰病死墓絕胎養"]];
const YIN_STAGES = [...[..."死病衰"], ...chunk("帝旺臨冠冠帶沐浴長生", 2), ...[..."養胎絕墓"]];

/** The branch each stem's cycle is anchored on, in stem-pair order. */
const ANCHORS = [..."亥寅寅巳申"];

/**
 * The branches each palace covers. The four cardinal palaces hold one; the four
 * corners hold two. 中宮 holds none, which is why it has no stage at all.
 */
export const PALACE_BRANCHES: Record<string, readonly string[]> = {
  坎: ["子"],
  艮: ["丑", "寅"],
  震: ["卯"],
  巽: ["辰", "巳"],
  離: ["午"],
  坤: ["未", "申"],
  兌: ["酉"],
  乾: ["戌", "亥"],
};

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
 * Which palaces a stem reaches a given stage in.
 *
 * This is the direction the reference implementation publishes — "these stems
 * are 墓 here" — and it is well defined where a per-palace label is not, since
 * one branch of a corner palace can qualify while the other does not.
 */
export function palacesAtStage(stem: string, stage: string): string[] {
  const byBranch = twelveStages(stem);
  return Object.entries(PALACE_BRANCHES)
    .filter(([, branches]) => branches.some((b) => byBranch[b] === stage))
    .map(([gong]) => gong);
}

export interface BranchStage {
  branch: string;
  stage: string;
}

export interface PalaceStage {
  /** The stem sitting in that palace. */
  stem: string;
  /**
   * One entry per branch the palace covers: one for a cardinal palace, two for
   * a corner. Empty only for 中宮, which has no branch.
   */
  stages: BranchStage[];
  /** True when any of the palace's branches puts the stem in 墓 (入墓). */
  entombed: boolean;
}

/** The stage of one stem in one palace. */
export function stageInPalace(stem: string, gong: string): PalaceStage {
  const byBranch = twelveStages(stem);
  const stages = (PALACE_BRANCHES[gong] ?? []).map((branch) => ({
    branch,
    stage: must(byBranch[branch], "stage for branch", { stem, branch }),
  }));
  return { stem, stages, entombed: stages.some((s) => s.stage === "墓") };
}

/** The 長生 reading of every palace on both plates. */
export function palaceStages(
  dt: CivilDateTime,
  method: Method
): { sky: Record<string, PalaceStage>; earth: Record<string, PalaceStage> } {
  const map = (plate: Record<string, string>): Record<string, PalaceStage> => {
    const out: Record<string, PalaceStage> = {};
    for (const [gong, stem] of Object.entries(plate)) out[gong] = stageInPalace(stem, gong);
    return out;
  };
  return { sky: map(panSky(dt, method)), earth: map(panEarth(dt, method)) };
}
