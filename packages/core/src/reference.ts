/**
 * The dictionaries. Names, five-element attributions and seasonal strength —
 * the things a reading needs to look up but that no chart carries in itself.
 *
 * Everything here is a table, not a judgement. There is no "生門 means good
 * news" entry, because that is a reading and readings belong to the agent.
 */
import { DI_ZHI, DOOR_R, DOOR_WUXING, EIGHT_GUA, JIEQI_CYCLE, STAR_R, STAR_WUXING, TIAN_GAN } from "./constants.js";
import { multiKeyGet, rotate, zipRecord } from "./util.js";
import { KinqimenError } from "./errors.js";
import { DOOR_FULL_NAMES, GOD_FULL_NAMES, STAR_FULL_NAMES } from "./stars-doors-gods.js";

export type ReferenceCategory = "door" | "star" | "god" | "stem" | "branch" | "palace" | "jieqi";

export interface ReferenceEntry {
  category: ReferenceCategory;
  key: string;
  /** Full traditional name, where the charts use an abbreviation. */
  name: string;
  /** 五行, where the tables assign one. */
  element?: string;
  /** Extra fields that only some categories carry. */
  [field: string]: unknown;
}

/** `config.Ganzhiwuxing` — 五行 of a stem or branch. */
export function ganzhiElement(character: string): string | undefined {
  const table: ReadonlyArray<readonly [readonly string[], string]> = [
    [[..."甲寅乙卯震巽"], "木"],
    [[..."丙巳丁午離"], "火"],
    [[..."壬亥癸子坎"], "水"],
    [[..."庚申辛酉乾兌"], "金"],
    [[..."未丑戊己未辰戌艮坤"], "土"],
  ];
  return multiKeyGet(table, character);
}

/** `config.wuxing_strong_week` — 旺相休囚死 for each element, by season. */
export function seasonalStrength(jieqi: string): { season: string; strength: Record<string, string> } {
  const seasons: ReadonlyArray<readonly [readonly string[], string]> = [
    [["立春", "雨水", "驚蟄", "春分", "清明", "穀雨"], "春"],
    [["立夏", "小滿", "芒種", "夏至", "小暑", "大暑"], "夏"],
    [["立秋", "處暑", "白露", "秋分", "寒露", "霜降"], "秋"],
    [["立冬", "小雪", "大雪", "冬至", "小寒", "大寒"], "冬"],
  ];
  const season = multiKeyGet(seasons, jieqi);
  if (season === undefined) {
    throw new KinqimenError("UNKNOWN_REFERENCE_KEY", `unknown solar term ${jieqi}`, { jieqi });
  }
  const orders: Record<string, string> = { 春: "木火水金土", 夏: "火土木水金", 秋: "金水土火木", 冬: "水木金土火" };
  const levels = [..."旺相休囚死"];
  return { season, strength: zipRecord([...(orders[season] as string)], levels) };
}

/** 九宮: number, trigram, direction and element. */
export const PALACES = EIGHT_GUA.map((gua, i) => ({
  number: i + 1,
  gua,
  element: ganzhiElement(gua) ?? "土",
  direction: ["北", "西南", "東", "東南", "中", "西北", "西", "東北", "南"][i] as string,
}));

function entry(category: ReferenceCategory, key: string, name: string, extra: Record<string, unknown> = {}): ReferenceEntry {
  return { category, key, name, ...extra };
}

/**
 * Look one thing up. Accepts either the abbreviation the charts use (`符`,
 * `休`, `蓬`) or the full name (`值符`, `休門`, `天蓬`).
 */
export function lookupReference(category: ReferenceCategory, key: string): ReferenceEntry {
  const fail = () => {
    throw new KinqimenError("UNKNOWN_REFERENCE_KEY", `no ${category} entry for ${key}`, { category, key });
  };

  switch (category) {
    case "door": {
      const short = DOOR_R.find((d) => d === key || DOOR_FULL_NAMES[d] === key);
      if (!short) return fail();
      return entry("door", short, DOOR_FULL_NAMES[short] as string, { element: DOOR_WUXING[short] });
    }
    case "star": {
      const short = [...STAR_R, "芮"].find((s) => s === key || STAR_FULL_NAMES[s] === key);
      if (!short) return fail();
      return entry("star", short, STAR_FULL_NAMES[short] as string, {
        // 芮 and 禽 share a palace and an element in the plate tables.
        element: STAR_WUXING[short] ?? STAR_WUXING["禽"],
      });
    }
    case "god": {
      const short = Object.keys(GOD_FULL_NAMES).find((g) => g === key || GOD_FULL_NAMES[g] === key);
      if (!short) return fail();
      return entry("god", short, GOD_FULL_NAMES[short] as string);
    }
    case "stem": {
      if (!TIAN_GAN.includes(key)) return fail();
      const isQi = "乙丙丁".includes(key);
      return entry("stem", key, key, {
        element: ganzhiElement(key),
        // 乙丙丁 are the 三奇; 戊己庚辛壬癸 are the 六儀.
        role: isQi ? "三奇" : key === "甲" ? "遁甲" : "六儀",
      });
    }
    case "branch": {
      if (!DI_ZHI.includes(key)) return fail();
      return entry("branch", key, key, { element: ganzhiElement(key) });
    }
    case "palace": {
      const palace = PALACES.find((p) => p.gua === key || String(p.number) === key);
      if (!palace) return fail();
      return entry("palace", palace.gua, palace.gua, {
        element: palace.element,
        number: palace.number,
        direction: palace.direction,
      });
    }
    case "jieqi": {
      if (!JIEQI_CYCLE.includes(key)) return fail();
      const { season, strength } = seasonalStrength(key);
      return entry("jieqi", key, key, { season, elementStrength: strength });
    }
    default:
      return fail();
  }
}

/** Every key a category accepts, for discovery. */
export function referenceKeys(category: ReferenceCategory): string[] {
  switch (category) {
    case "door":
      return [...DOOR_R];
    case "star":
      return [...STAR_R, "芮"];
    case "god":
      return Object.keys(GOD_FULL_NAMES);
    case "stem":
      return [...TIAN_GAN];
    case "branch":
      return [...DI_ZHI];
    case "palace":
      return [...EIGHT_GUA];
    case "jieqi":
      return rotate(JIEQI_CYCLE, "立春");
    default:
      return [];
  }
}
