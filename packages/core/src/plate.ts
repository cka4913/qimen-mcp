/**
 * 地盤 and 天盤 — where the nine stems sit, before and after the 值符 rotates.
 *
 * The earth plate is simple: walk the nine palaces from the bureau number and
 * lay the nine stems on them in 陽遁 or 陰遁 order.
 *
 * The sky plate is not. Upstream's `Qimen.pan_sky` is a ladder of four branches
 * with overlapping conditions, two of which are unreachable and one of which
 * raises. Rather than copy the tangle, the reachable behaviour is spelled out
 * below with the dead paths marked; `packages/fixtures/tests/hour-parity.spec.ts`
 * holds it to upstream's output over the whole corpus, so the simplification is
 * verified rather than assumed.
 */
import { CLOCKWISE_EIGHTGUA, CNUMBER, EARTH_STEM_ORDER, EIGHT_GUA } from "./constants.js";
import { dtKey, type CivilDateTime } from "./calendar.js";
import { pillars } from "./ganzhi.js";
import { invertRecord, memoize, rotate, tryRotate, zipRecord } from "./util.js";
import { must } from "./errors.js";
import { juHead, juLabel, zhifuNZhishi, type Method } from "./zhifu.js";
import { panGod } from "./stars-doors-gods.js";

/**
 * Palace order the plates are walked in, per 遁: 陽遁 clockwise, 陰遁 the plain
 * reverse of it.
 *
 * Upstream instead uses `艮乾兌坤離巽震坎`, which is this reverse with 艮 moved
 * from seventh place to first, breaking the symmetry between the two 遁 for no
 * stated reason. Substituting the plain reverse reproduces a reference
 * implementation exactly on the 陰遁 charts we have; upstream's does not. See
 * docs/PORTING-NOTES.md D10.
 */
export function rotationOrder(dun: string): string[] {
  return dun === "陰" ? [...CLOCKWISE_EIGHTGUA].reverse() : [...CLOCKWISE_EIGHTGUA];
}

/** `Qimen.pan_earth` — trigram → stem, all nine palaces. */
function panEarthUncached(dt: CivilDateTime, method: Method): Record<string, string> {
  const label = juLabel(dt, method);
  const { kook } = juHead(label);
  const dun = label.slice(0, 2);
  const byNumber = zipRecord(CNUMBER, EIGHT_GUA);
  const palaces = rotate(CNUMBER, kook).map((n) => must(byNumber[n], "palace for number", { n }));
  return zipRecord(palaces, must(EARTH_STEM_ORDER[dun], "earth stem order", { dun }));
}

const methodKey = (dt: CivilDateTime, method: Method): string => `${dtKey(dt)}|${method}`;

export const panEarth = memoize(methodKey, panEarthUncached);

/** The earth plate read backwards: stem → trigram. */
export function panEarthReverse(dt: CivilDateTime, method: Method): Record<string, string> {
  return invertRecord(panEarth(dt, method));
}

/**
 * `Qimen.pan_sky` — trigram → stem after the 值符 has carried its stem to the
 * hour stem's palace.
 *
 * Three cases, in upstream's order:
 *
 *  1. **值符 sits in 中宮.** It has no palace of its own to rotate from, so the
 *     plate is anchored on 坤 (中寄坤). Which stem leads depends on whether 坤
 *     currently holds the 值符 itself.
 *  2. **值符星 is 禽.** 禽 is the 中宮 star lent out to 坤, so the stem order is
 *     anchored on 坤's stem rather than on the 值符's own.
 *  3. **Everything else.** Rotate the eight outer stems to the 值符's stem and
 *     lay them from the 值符's palace; 中 keeps the stem it had.
 */
function panSkyUncached(dt: CivilDateTime, method: Method): Record<string, string> {
  const label = juLabel(dt, method);
  const dun = label[0] as string;
  const order = rotationOrder(dun);

  const zz = zhifuNZhishi(dt, method);
  const fuHead = zz.zhifuStem[1];
  const fuHeadLocation = zz.zhifuStar[1];
  const zhifuStar = zz.zhifuStar[0].replace("芮", "禽");

  const earth = panEarth(dt, method);
  const earthReverse = invertRecord(earth);
  const hourStem = pillars(dt).hour[0] as string;
  const fuLocation = earthReverse[hourStem];
  const outerStems = order.map((g) => must(earth[g], "earth stem", { g }));
  const kunStem = must(earth["坤"], "earth stem at 坤", {});
  const kunAnchored = rotate(order, "坤");

  // Case 1 — 值符 in 中宮.
  if (fuHeadLocation === "中") {
    // Upstream tries to rotate the palaces to 中 first, which always throws
    // (中 is not among the eight), so only this fallback is ever reached.
    if (panGod(dt, method)["坤"] !== "符") {
      return zipRecord(kunAnchored, rotate(outerStems, kunStem));
    }
    if (kunStem === fuHead) {
      const last = outerStems[outerStems.length - 1] as string;
      return zipRecord(kunAnchored, rotate(outerStems, last));
    }
    const rotated = tryRotate(outerStems, fuHead) ?? rotate(outerStems, kunStem);
    return zipRecord(kunAnchored, rotated);
  }

  const gongFromFu = rotate(order, fuHeadLocation);

  // Case 2 — 值符星 is 禽 (中宮's star, lent to 坤).
  if (zhifuStar === "禽") {
    const stems = rotate(outerStems, kunStem);
    if (!stems.includes(fuHead)) {
      // The 值符's stem is the one parked in 中宮, so the palaces start from the
      // hour stem's palace instead. Upstream would raise if the hour stem were
      // itself in 中宮; `must` reports that rather than producing a wrong plate.
      const anchored = rotate(gongFromFu, must(fuLocation, "palace of the hour stem", { hourStem }));
      return zipRecord(anchored, stems);
    }
    return { ...zipRecord(gongFromFu, stems), 中: must(earth["中"], "earth stem at 中", {}) };
  }

  // Case 3 — the ordinary rotation.
  const stems = tryRotate(outerStems, fuHead);
  if (stems === null) {
    // 值符's stem is in 中宮 and the star is not 禽. Upstream raises a bare
    // ValueError here; this reports the same impossibility with a code.
    return must(undefined as Record<string, string> | undefined, "sky plate: 值符 stem is in 中宮 with a non-禽 值符星", {
      fuHead,
      fuHeadLocation,
      zhifuStar,
    });
  }
  if (fuLocation === undefined) return earth;
  return { ...zipRecord(gongFromFu, stems), 中: must(earth["中"], "earth stem at 中", {}) };
}

export const panSky = memoize(methodKey, panSkyUncached);
