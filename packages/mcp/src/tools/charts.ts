/**
 * The three chart tools plus the bureau tool.
 *
 * Every description tells the agent two things it cannot see from the schema:
 * what the numbers *are*, and what the tool refuses to do. None of these return
 * a verdict — the plates are facts, the reading is the agent's.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildChart, buildGoldenMirrorChart, buildKeChart, juChaibu, juKe, juZhirun, pillars, zhirunRaw } from "@kinqimen/core";
import { chartShape, datetimeShape, toCivilDateTime } from "../schemas.js";
import { safe } from "../errors.js";
import { goldenMirrorChartSchema, juResultSchema, keChartSchema, qimenChartSchema, shapeOf } from "../output-schemas.js";

export function registerQimenChart(server: McpServer): void {
  server.registerTool(
    "get_qimen_chart",
    {
      title: "時家奇門排盤",
      description:
        "時家奇門全盤——最常用嗰種，一個時辰一盤。回：四柱刻柱、農曆、旬首旬空、局日、排局、節氣、" +
        "值符值使（星／門同佢哋落嘅宮）、天乙、天盤地盤（宮→天干）、九星、八門、八神、三種馬星、" +
        "同天地兩盤每宮嘅十二長生。" +
        "宮位一律用卦名做 key（坎坤震巽中乾兌艮離）。" +
        "留意：值符入中宮嗰陣天盤只有八宮，中宮唔會出現——唔係漏咗，係中宮寄坤之後個天盤本身就得八位。" +
        "本 tool 只回盤面事實，唔會講吉凶，亦唔會幫你揀用神。",
      inputSchema: chartShape,
      outputSchema: shapeOf(qimenChartSchema),
    },
    async ({ datetime, method }) => safe(() => buildChart(toCivilDateTime(datetime), method))
  );
}

export function registerKeChart(server: McpServer): void {
  server.registerTool(
    "get_qimen_chart_minute",
    {
      title: "刻家奇門排盤",
      description:
        "刻家奇門全盤——以十分鐘為一刻起盤，比時家精細。結構同時家一樣，另加暗干（干支→宮）同飛干。" +
        "留意三點：" +
        "(1) 刻家嘅排局同節氣無關，只睇時支陰陽同刻柱三元，所以個局名格式係「陽一局上元」；" +
        "(2) `kong` 係時空同刻空，唔係時家嗰個日空時空；" +
        "(3) 天乙照舊由時家盤嚟，所以 `method` 喺呢度仍然有影響。",
      inputSchema: chartShape,
      outputSchema: shapeOf(keChartSchema),
    },
    async ({ datetime, method }) => safe(() => buildKeChart(toCivilDateTime(datetime), method))
  );
}

export function registerGoldenMirror(server: McpServer): void {
  server.registerTool(
    "get_golden_mirror_chart",
    {
      title: "金函玉鏡（日家奇門）",
      description:
        "金函玉鏡日家奇門——一日一盤，只睇日柱同冬至／夏至半年，唔使時辰，所以無 method 參數。" +
        "回：局、九個金函星（太乙攝提軒轅招搖天符青龍咸池太陰天乙）落宮、八門落宮（中宮無門，回空字串）、" +
        "同日干對應嘅十二神。" +
        "`craneGod`（鶴神）大部分日子係 null：上游張表得頭八個日柱有值，而且回嘅係重複字元嘅 list 唔係方位。" +
        "呢個係上游行為，照搬保留，唔好當佢係方位讀——詳見 docs/PORTING-NOTES.md。",
      inputSchema: datetimeShape,
      outputSchema: shapeOf(goldenMirrorChartSchema),
    },
    async ({ datetime }) => safe(() => buildGoldenMirrorChart(toCivilDateTime(datetime)))
  );
}

export function registerJu(server: McpServer): void {
  server.registerTool(
    "get_ju",
    {
      title: "排局（兩派＋置閏推導）",
      description:
        "淨計排局，唔排成個盤。同時回拆補、置閏、刻家三個局名，再加置閏法嘅完整推導：" +
        "距節氣日數、三元、值符天干，同置閏階梯揀緊嘅四個候選局" +
        "（當前排局 current／超神接氣正授 chaoshen／其他排局 other／其他排局1 other1）。" +
        "適合兩個場合：想同用戶解釋點解今日係呢個局；或者想喺唔排盤嘅情況下比較兩派結論差幾遠。",
      inputSchema: datetimeShape,
      outputSchema: shapeOf(juResultSchema),
    },
    async ({ datetime }) =>
      safe(() => {
        const dt = toCivilDateTime(datetime);
        const gz = pillars(dt);
        const raw = zhirunRaw(dt);
        return {
          resolved: { datetime: dt },
          jieqi: raw.jieqi,
          dayPillar: gz.day,
          hourPillar: gz.hour,
          kePillar: gz.ke,
          chaibu: juChaibu(dt),
          zhirun: juZhirun(dt),
          ke: juKe(dt),
          zhirunWorkings: raw,
        };
      })
  );
}
