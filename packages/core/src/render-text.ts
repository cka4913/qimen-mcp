/**
 * Text views of a chart.
 *
 * Upstream renders to HTML for a web page. A calling agent wants neither HTML
 * nor pixels, so these render the same nine-palace layout as plain text: the
 * traditional 洛書 square, read the way a practitioner reads it.
 *
 * These are *views*. They add nothing a chart does not already contain, and
 * nothing here is on the path of any calculation.
 */
import type { QimenChart } from "./chart.js";
import type { KeChart } from "./ke.js";
import type { GoldenMirrorChart } from "./golden-mirror.js";

/** The 洛書 square, top row first. 中 sits in the middle. */
const GRID = [
  ["巽", "離", "坤"],
  ["震", "中", "兌"],
  ["艮", "坎", "乾"],
];

function padCell(lines: string[], width: number): string[] {
  return lines.map((line) => {
    // Chinese characters are double-width in a monospace terminal.
    const visual = [...line].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2000 ? 2 : 1), 0);
    return line + " ".repeat(Math.max(0, width - visual));
  });
}

function renderGrid(cellLines: (gong: string) => string[]): string {
  const width = Math.max(
    ...GRID.flat().flatMap((gong) =>
      cellLines(gong).map((line) => [...line].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2000 ? 2 : 1), 0))
    )
  );
  const out: string[] = [];
  const border = `+${Array(3).fill("-".repeat(width + 2)).join("+")}+`;
  out.push(border);
  for (const row of GRID) {
    const cells = row.map((gong) => padCell(cellLines(gong), width));
    const height = Math.max(...cells.map((c) => c.length));
    for (let i = 0; i < height; i++) {
      out.push(`| ${cells.map((c) => c[i] ?? " ".repeat(width)).join(" | ")} |`);
    }
    out.push(border);
  }
  return out.join("\n");
}

/** 中宮 holds no gate, and the sky plate skips it when the 值符 sits there. */
const doorCell = (name: string | undefined) => (name ? `${name}門` : "　　");
const skyCell = (stem: string | undefined) => (stem ? `天${stem}` : "　　");

/** The 時家 chart as a nine-palace text square with a header. */
export function renderChartText(chart: QimenChart): string {
  const p = chart.pillars;
  const header = [
    `時家奇門｜${chart.methodName}`,
    `${p.year}年 ${p.month}月 ${p.day}日 ${p.hour}時`,
    `${chart.ju}｜節氣：${chart.jieqi}｜局日：${chart.juDay}`,
    `值符：天${chart.zhifuZhishi.zhifuStar[0]} 在 ${chart.zhifuZhishi.zhifuStar[1]}宮` +
      `｜值使：${chart.zhifuZhishi.zhishiDoor[0]}門 在 ${chart.zhifuZhishi.zhishiDoor[1]}宮`,
    `旬首：${chart.xunHead.hour}（${chart.xunStem}）｜日空：${chart.kong.day}　時空：${chart.kong.hour}`,
    `馬星：天馬${chart.horses.tianMa} 丁馬${chart.horses.dingMa} 驛馬${chart.horses.yiMa}`,
  ].join("\n");

  const grid = renderGrid((gong) => [
    `${chart.gods[gong] ?? "　"}　${doorCell(chart.doors[gong])}`,
    `${chart.stars[gong] ?? "　"}　${skyCell(chart.skyPlate[gong])}`,
    `${gong}　地${chart.earthPlate[gong] ?? "　"}`,
  ]);

  return `${header}\n\n${grid}\n\n每格：神／門　星／天盤干　宮／地盤干`;
}

/** The 刻家 chart, same layout plus the 暗干 row. */
export function renderKeChartText(chart: KeChart): string {
  const p = chart.pillars;
  const hiddenByGong: Record<string, string> = {};
  for (const [ganzhi, gong] of Object.entries(chart.angan.hidden)) hiddenByGong[gong] = ganzhi;

  const header = [
    `刻家奇門｜${chart.methodName}`,
    `${p.year}年 ${p.month}月 ${p.day}日 ${p.hour}時 ${p.ke}刻`,
    `${chart.ju}｜節氣：${chart.jieqi}`,
    `值符：天${chart.zhifuZhishi.zhifuStar[0]} 在 ${chart.zhifuZhishi.zhifuStar[1]}宮` +
      `｜值使：${chart.zhifuZhishi.zhishiDoor[0]}門 在 ${chart.zhifuZhishi.zhishiDoor[1]}宮`,
    `時空：${chart.kong.hour}　刻空：${chart.kong.ke}｜飛干：${chart.angan.flying}`,
  ].join("\n");

  const grid = renderGrid((gong) => [
    `${chart.gods[gong] ?? "　"}　${doorCell(chart.doors[gong])}`,
    `${chart.stars[gong] ?? "　"}　${skyCell(chart.skyPlate[gong])}`,
    `${gong}　地${chart.earthPlate[gong] ?? "　"}`,
    `暗${hiddenByGong[gong] ?? "　　"}`,
  ]);

  return `${header}\n\n${grid}\n\n每格：神／門　星／天盤干　宮／地盤干　暗干`;
}

/** The 金函玉鏡 day chart. */
export function renderGoldenMirrorText(chart: GoldenMirrorChart): string {
  const header = [`金函玉鏡（日家奇門）`, `${chart.ju}｜節氣：${chart.jieqi}`].join("\n");
  const grid = renderGrid((gong) => [
    `${chart.stars[gong] ?? "　　"}`,
    `${gong}　${doorCell(chart.doors[gong])}`,
  ]);
  return `${header}\n\n${grid}\n\n每格：金函星／宮　門`;
}
