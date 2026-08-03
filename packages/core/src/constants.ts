/**
 * The fixed tables every other module reads. Ported verbatim from the upstream
 * `config.py` / `jieqi.py` header constants — order matters everywhere, so none
 * of these lists may be sorted, deduplicated or "tidied".
 */
import { chunk } from "./util.js";

export const TIAN_GAN = [..."甲乙丙丁戊己庚辛壬癸"];
export const DI_ZHI = [..."子丑寅卯辰巳午未申酉戌亥"];

/** 六十甲子, in order. `config.jiazi()` */
export const JIAZI: readonly string[] = Array.from({ length: 60 }, (_, i) =>
  `${TIAN_GAN[i % 10]}${DI_ZHI[i % 12]}`
);

export const CNUMBER = [..."一二三四五六七八九"];
export const CNUM = [..."一二三四五六七八九十"];

/** 八門, in 洛書 order matching `EIGHT_GUA`. */
export const DOOR_R = [..."休生傷杜景死驚開"];
/** 九星 short names. */
export const STAR_R = [..."蓬任沖輔英禽柱心"];
/** 九宮 by 洛書 number 1..9 (index 4 is 中). */
export const EIGHT_GUA = [..."坎坤震巽中乾兌艮離"];
/** The eight outer palaces walked clockwise. */
export const CLOCKWISE_EIGHTGUA = [..."坎艮震巽離坤兌乾"];
/**
 * The 陰遁 traversal order upstream uses. **Not used by this engine** — kept
 * only so the deviation test can show what it was.
 *
 * It is `CLOCKWISE_EIGHTGUA` reversed with 艮 lifted from seventh place to
 * first. That asymmetry produced every 陰遁 disagreement this port had with a
 * reference implementation; the plain reverse removes them. See
 * docs/PORTING-NOTES.md D10.
 */
export const UPSTREAM_YIN_EIGHTGUA_ORDER = [..."艮乾兌坤離巽震坎"];

/** 金函玉鏡 nine stars. */
export const GOLDEN_STARS = chunk("太乙攝提軒轅招搖天符青龍咸池太陰天乙", 2);

/**
 * 二十四節氣 in the order upstream rotates through (`config.jieqi_name`),
 * starting at 春分. Distinct from `JIEQI_SXTWL_ORDER`.
 */
export const JIEQI_CYCLE = chunk(
  "春分清明穀雨立夏小滿芒種夏至小暑大暑立秋處暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒立春雨水驚蟄",
  2
);

/** The index order sxtwl reports solar terms in (`jqmc`), starting at 小寒. */
export const JIEQI_SXTWL_ORDER = [
  "小寒", "大寒", "立春", "雨水", "驚蟄", "春分", "清明", "穀雨", "立夏", "小滿", "芒種", "夏至",
  "小暑", "大暑", "立秋", "處暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
];

/** 旬首 stem for each 甲-headed 旬. `config.jj` */
export const XUN_HEAD_STEM: Record<string, string> = {
  甲子: "戊", 甲戌: "己", 甲申: "庚", 甲午: "辛", 甲辰: "壬", 甲寅: "癸",
};

/** 八門 / 九星 五行 attributions. */
export const DOOR_WUXING: Record<string, string> = Object.fromEntries(
  DOOR_R.map((d, i) => [d, [..."水土木木火土金金"][i] as string])
);
export const STAR_WUXING: Record<string, string> = Object.fromEntries(
  STAR_R.map((s, i) => [s, [..."水土木木火土金金"][i] as string])
);

/** 陽遁 / 陰遁 地盤 stem order. */
export const EARTH_STEM_ORDER: Record<string, string[]> = {
  陽遁: [..."戊己庚辛壬癸丁丙乙"],
  陰遁: [..."戊乙丙丁癸壬辛庚己"],
};

/** 農曆月 display names, index 1..12. `jieqi.lunar_date_d` */
export const LUNAR_MONTH_NAMES = [
  "占位", "正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月",
];
