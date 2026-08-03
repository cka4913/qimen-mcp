/**
 * 找局 — the search tool.
 *
 * The description carries more weight here than on the chart tools, because
 * the failure mode is silent: a query that is too loose returns plausible
 * results that happen to be 40% of all time, and an agent cannot tell. So the
 * description says out loud which conditions are and are not selective.
 */
import { z } from "zod";
import { findChartTimes, SEARCH_DEFAULTS, type SearchCriteria } from "@cka4913/qimen-core";
import { dateSchema, methodSchema, toCivilDate } from "../schemas.js";
import { safe } from "../errors.js";
import { searchResultSchema, shapeOf } from "../output-schemas.js";

export function registerSearch(server: import("@modelcontextprotocol/sdk/server/mcp.js").McpServer): void {
  server.registerTool(
    "find_chart_times",
    {
      title: "找局（搜尋符合條件的時辰）",
      description:
        "由指定日期開始逐個時辰掃描，搵出盤面符合條件嘅時刻，用於擇時。" +
        "\n\n" +
        "**比對以「宮位」為單位：所有已指定嘅條件必須喺同一個宮同時成立。** " +
        "例如 doors:[生] + skyStems:[丙] 係搵「生門同天盤丙落喺同一宮」，" +
        "唔係「盤入面有生門，而且某處有丙」。每筆結果都會講明中咗邊個宮。" +
        "\n\n" +
        "**留意條件嘅篩選力**：每張盤都必然齊集八門、八神、八星同八至九個天盤干，" +
        "所以單獨用一個門／星／神條件（唔限宮位）會命中全部時辰，等於冇篩過。" +
        "格局亦唔算罕見——青龍返首約佔全部時辰 18%。" +
        "要有實用密度，請夾多過一個條件，或者限定宮位。" +
        "\n\n" +
        "掃描搵夠 `limit` 個就停，唔會掃完全程，所以**唔會回總數**——回一個假總數比唔回更差。" +
        "要繼續搵就用回傳嘅 `scannedThrough` 做下次嘅 `start`。" +
        `\n\n預設最多掃 ${SEARCH_DEFAULTS.maxDays} 日（約 5 年）先放棄，避免條件永不命中時無限行落去；` +
        "`budgetExhausted` 會講明係咪撞到呢個上限。" +
        "\n\n只支援時家奇門。時辰以其代表時刻回報，注意子時由前一日 23:00 開始。",
      inputSchema: {
        start: dateSchema.describe("掃描起點日期。"),
        end: dateSchema
          .optional()
          .describe("硬邊界（含當日）。唔傳就開放式掃到搵夠或耗盡預算為止。方向向後時，end 要早過 start。"),
        direction: z
          .enum(["forward", "backward"])
          .optional()
          .default("forward")
          .describe("forward 向未來搵（預設）；backward 向過去搵，用嚟答「上一次係幾時」。"),
        method: methodSchema,
        palaces: z
          .array(z.enum(["坎", "坤", "震", "巽", "中", "乾", "兌", "艮", "離"]))
          .optional()
          .describe("限定宮位；唔傳＝任何宮。多個宮之間係 OR。注意中宮冇門、星、神。"),
        skyStems: z.array(z.string()).optional().describe("天盤天干，多個之間 OR。"),
        earthStems: z.array(z.string()).optional().describe("地盤天干，多個之間 OR。"),
        doors: z.array(z.string()).optional().describe("八門簡稱（休生傷杜景死驚開），多個之間 OR。"),
        stars: z.array(z.string()).optional().describe("九星簡稱（蓬任沖輔英禽柱心芮），多個之間 OR。"),
        gods: z.array(z.string()).optional().describe("八神簡稱（符蛇陰合勾雀虎玄地天），多個之間 OR。"),
        patterns: z
          .array(z.enum(["greenDragon", "flyingBird", "jadeGirl"]))
          .optional()
          .describe(
            "格局，同其他條件一樣屬宮位層：該宮必須就係格局成形嘅宮。" +
              "留意青龍返首（天盤戊臨地盤丙）同飛鳥跌穴（天盤丙臨地盤戊）邏輯上唔可能同宮，同時指定必然零結果。"
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(SEARCH_DEFAULTS.maxLimit)
          .optional()
          .default(SEARCH_DEFAULTS.limit)
          .describe(`搵夠幾多個就停，預設 ${SEARCH_DEFAULTS.limit}，上限 ${SEARCH_DEFAULTS.maxLimit}。`),
        maxDays: z
          .number()
          .int()
          .min(1)
          .max(SEARCH_DEFAULTS.maxMaxDays)
          .optional()
          .default(SEARCH_DEFAULTS.maxDays)
          .describe(
            `掃描預算（日數），預設 ${SEARCH_DEFAULTS.maxDays}，上限 ${SEARCH_DEFAULTS.maxMaxDays}。` +
              "掃夠呢個日數仲未夠數就停，並將 budgetExhausted 設為 true。"
          ),
      },
      outputSchema: shapeOf(searchResultSchema),
    },
    async ({ start, end, direction, method, limit, maxDays, ...criteria }) =>
      safe(() => {
        const search: SearchCriteria = {};
        // Only forward the criteria the caller actually set, so `resolved`
        // echoes the query rather than a shape padded with empty arrays.
        if (criteria.palaces?.length) search.palaces = criteria.palaces;
        if (criteria.skyStems?.length) search.skyStems = criteria.skyStems;
        if (criteria.earthStems?.length) search.earthStems = criteria.earthStems;
        if (criteria.doors?.length) search.doors = criteria.doors;
        if (criteria.stars?.length) search.stars = criteria.stars;
        if (criteria.gods?.length) search.gods = criteria.gods;
        if (criteria.patterns?.length) search.patterns = criteria.patterns;

        return findChartTimes(search, {
          start: toCivilDate(start),
          ...(end ? { end: toCivilDate(end) } : {}),
          direction,
          method,
          limit,
          maxDays,
        });
      })
  );
}
