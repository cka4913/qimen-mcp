/**
 * The tools that are not charts: the clock, the patterns, the rite, the text
 * view and the dictionary.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildChart,
  buildGoldenMirrorChart,
  buildKeChart,
  closedSixwu,
  closedSixwuForXun,
  lookupReference,
  patterns,
  referenceKeys,
  renderChartText,
  renderGoldenMirrorText,
  renderKeChartText,
  type ReferenceCategory,
} from "@kinqimen/core";
import { datetimeSchema, methodSchema, sixwuVersionSchema, toCivilDateTime } from "../schemas.js";
import { safe } from "../errors.js";
import {
  patternsResultSchema,
  renderResultSchema,
  resolveTimeResultSchema,
  shapeOf,
  sixwuResultSchema,
} from "../output-schemas.js";

export function registerResolveTime(server: McpServer): void {
  server.registerTool(
    "resolve_time",
    {
      title: "讀取現在時間",
      description:
        "全個 server 唯一會讀系統時鐘嘅 tool。回而家嘅民用時間，格式啱啱好可以原封不動傳俾其他 tool。" +
        "所有排盤 tool 都唔會自己 call 呢個——要起「而家」嘅盤，你要先 call 呢度、再將 `datetime` 明文傳落去。" +
        "咁做係為咗令每個排盤 response 都可重現：同一組 input 永遠得同一個盤，可以快取、可以覆核。" +
        "`timezone` 用 IANA 名（例如 Asia/Hong_Kong），唔傳就用 server 本身嘅時區。" +
        "奇門睇嘅係當地時間，所以應該傳問事人所在地嘅時區。",
      inputSchema: {
        timezone: z
          .string()
          .optional()
          .describe("IANA 時區名，例如 Asia/Hong_Kong。唔傳就用 server 時區。"),
      },
      outputSchema: shapeOf(resolveTimeResultSchema),
    },
    async ({ timezone }) =>
      safe(() => {
        const tz = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date());
        const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
        const civil = {
          year: get("year"),
          month: get("month"),
          day: get("day"),
          hour: get("hour"),
          minute: get("minute"),
        };
        const pad = (n: number, w = 2) => String(n).padStart(w, "0");
        return {
          datetime: `${pad(civil.year, 4)}-${pad(civil.month)}-${pad(civil.day)}T${pad(civil.hour)}:${pad(civil.minute)}`,
          timezone: tz,
          civil,
          note: "將 datetime 原封不動傳俾排盤 tool。引擎唔會自己讀時鐘。",
        };
      })
  );
}

export function registerPatterns(server: McpServer): void {
  server.registerTool(
    "check_patterns",
    {
      title: "格局判定",
      description:
        "檢查三個格局有無成形，成形就回落宮，冇就回 null：" +
        "青龍返首（天盤戊臨地盤丙）、飛鳥跌穴（天盤丙臨地盤戊）、玉女守門（地盤丁同值使門同宮）。" +
        "回嘅係盤面事實——邊個天干落咗邊個宮——唔係吉凶判斷。" +
        "呢三個係上游有實作嘅格局，唔係奇門格局嘅全部；" +
        "其餘吉凶格（如乙奇得使、白虎猖狂等）要你自己由 get_qimen_chart 嘅天地盤同門星神組合去讀。",
      inputSchema: { datetime: datetimeSchema, method: methodSchema },
      outputSchema: shapeOf(patternsResultSchema),
    },
    async ({ datetime, method }) =>
      safe(() => {
        const dt = toCivilDateTime(datetime);
        return { resolved: { datetime: dt, method }, ...patterns(dt, method) };
      })
  );
}

export function registerSixwu(server: McpServer): void {
  server.registerTool(
    "get_closed_sixwu",
    {
      title: "真人閉六戊法路徑",
      description:
        "法術奇門嘅真人閉六戊法：搵出戊落嘅地支，再沿六陽支行一個圈（七步，尾步返回起點），連每步落嘅宮。" +
        "起點由旬首決定——傳 `datetime` 就用時柱嘅旬首，或者直接傳 `xunHead`（甲子／甲戌／甲申／甲午／甲辰／甲寅）。" +
        "`version` 要明文傳：演義版逆布連土、寶鑑版順布連土，兩個傳承方向相反，冇預設。" +
        "呢個係法術層面嘅嘢，用戶冇明確問就唔好主動出。",
      inputSchema: {
        datetime: datetimeSchema.optional(),
        xunHead: z
          .enum(["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"])
          .optional()
          .describe("直接指定旬首。同 datetime 二擇其一；兩個都傳就以 xunHead 為準。"),
        version: sixwuVersionSchema,
      },
      outputSchema: shapeOf(sixwuResultSchema),
    },
    async ({ datetime, xunHead, version }) =>
      safe(() => {
        if (xunHead) return closedSixwuForXun(xunHead, version);
        if (!datetime) {
          throw new Error("需要 datetime 或 xunHead 其中一個");
        }
        return closedSixwu(toCivilDateTime(datetime), version);
      })
  );
}

export function registerRenderText(server: McpServer): void {
  server.registerTool(
    "render_chart_text",
    {
      title: "文字盤",
      description:
        "將盤畫成九宮文字方格，方便直接俾人睇或者貼落對話入面。" +
        "`style` 揀邊種盤：hour（時家）、minute（刻家）、golden（金函玉鏡）。" +
        "呢個純粹係 view，冇任何新資料——要做推演請用 get_qimen_chart 攞結構化嘅盤。",
      inputSchema: {
        datetime: datetimeSchema,
        method: methodSchema,
        style: z
          .enum(["hour", "minute", "golden"])
          .optional()
          .default("hour")
          .describe("要畫邊種盤：hour 時家（預設）、minute 刻家、golden 金函玉鏡。"),
      },
      outputSchema: shapeOf(renderResultSchema),
    },
    async ({ datetime, method, style }) =>
      safe(() => {
        const dt = toCivilDateTime(datetime);
        if (style === "minute") return { text: renderKeChartText(buildKeChart(dt, method)) };
        if (style === "golden") return { text: renderGoldenMirrorText(buildGoldenMirrorChart(dt)) };
        return { text: renderChartText(buildChart(dt, method)) };
      })
  );
}

const CATEGORIES = ["door", "star", "god", "stem", "branch", "palace", "jieqi"] as const;

export function registerLookup(server: McpServer): void {
  server.registerTool(
    "lookup_reference",
    {
      title: "名詞查詢",
      description:
        "查單一名詞嘅全稱、五行同基本屬性。盤面用簡稱（符、休、蓬），呢度簡稱同全稱（值符、休門、天蓬）都收。" +
        "category：door 八門、star 九星、god 八神、stem 天干（連三奇／六儀身份）、branch 地支、" +
        "palace 九宮（宮數、卦、方位、五行）、jieqi 節氣（所屬季節同五行旺相休囚死）。" +
        "唔傳 `key` 就回該類全部可查嘅 key。" +
        "呢度只回表上有嘅資料——冇「生門主吉」呢類判語，因為嗰啲係解讀，唔係事實。",
      inputSchema: {
        category: z.enum(CATEGORIES).describe("要查邊本字典。"),
        key: z.string().optional().describe("要查嘅名，簡稱或全稱皆可。唔傳就列出該類全部 key。"),
      },
    },
    async ({ category, key }) =>
      safe(() => {
        if (key === undefined) return { category, keys: referenceKeys(category as ReferenceCategory) };
        return lookupReference(category as ReferenceCategory, key);
      })
  );
}
