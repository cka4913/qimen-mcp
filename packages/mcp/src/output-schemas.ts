/**
 * Output schemas for every tool.
 *
 * These are **load-bearing at runtime**: when a tool declares an `outputSchema`,
 * the MCP SDK validates `structuredContent` against it on every successful call
 * and raises a protocol error if it does not match. (`isError` results are
 * exempt, so business failures pass through untouched.)
 *
 * That makes drift from `@cka4913/qimen-core`'s types a real failure mode rather than
 * a documentation nit, so it is guarded twice over:
 *
 *  - **Compile time** — `types-check.ts` asserts each schema's inferred type is
 *    mutually assignable with the corresponding core type. Rename or drop a
 *    field in core and the build fails there.
 *  - **Run time** — `output-schemas.spec.ts` parses real engine output for a
 *    spread of inputs through these schemas.
 *
 * Objects are `.strict()` on purpose: an unexpected field should fail loudly in
 * test rather than quietly escape the contract clients are told to rely on.
 */
import { z } from "zod";

/** trigram → whatever sits there. 中 is absent from some plates by design. */
const byPalace = z.record(z.string(), z.string());

const civilDateTime = z
  .object({
    year: z.number().int(),
    month: z.number().int(),
    day: z.number().int(),
    hour: z.number().int(),
    minute: z.number().int(),
  })
  .strict();

const pillars = z
  .object({
    year: z.string(),
    month: z.string(),
    day: z.string(),
    hour: z.string(),
    ke: z.string(),
  })
  .strict();

const lunarDate = z
  .object({
    year: z.number().int(),
    month: z.number().int(),
    monthName: z.string(),
    day: z.number().int(),
    isLeap: z.boolean(),
  })
  .strict();

const zhifuZhishi = z
  .object({
    zhifuStem: z.tuple([z.string(), z.string()]),
    zhifuStar: z.tuple([z.string(), z.string()]),
    zhishiDoor: z.tuple([z.string(), z.string()]),
  })
  .strict();

const horses = z.object({ tianMa: z.string(), dingMa: z.string(), yiMa: z.string() }).strict();

const method = z.enum(["chaibu", "zhirun"]);

const palaceStage = z
  .object({
    stem: z.string(),
    // One entry per branch the palace covers — two for the four corner palaces,
    // one for the cardinals, none for 中宮. A corner palace genuinely has no
    // single stage, so this is a list rather than a label.
    stages: z.array(z.object({ branch: z.string(), stage: z.string() }).strict()),
    entombed: z.boolean(),
  })
  .strict();

export const qimenChartSchema = z
  .object({
    resolved: z.object({ datetime: civilDateTime, method }).strict(),
    methodName: z.string(),
    pillars,
    lunar: lunarDate,
    xunStem: z.string(),
    xunHead: z.object({ day: z.string(), hour: z.string() }).strict(),
    kong: z.object({ day: z.string(), hour: z.string() }).strict(),
    juDay: z.string(),
    ju: z.string(),
    jieqi: z.string(),
    zhifuZhishi,
    tianyi: z.string(),
    skyPlate: byPalace,
    earthPlate: byPalace,
    doors: byPalace,
    stars: byPalace,
    gods: byPalace,
    horses,
    stages: z
      .object({
        sky: z.record(z.string(), palaceStage),
        earth: z.record(z.string(), palaceStage),
      })
      .strict(),
  })
  .strict();

const anganResult = z.object({ hidden: byPalace, flying: z.string() }).strict();

export const keChartSchema = z
  .object({
    resolved: z.object({ datetime: civilDateTime, method }).strict(),
    methodName: z.string(),
    pillars,
    lunar: lunarDate,
    xunStem: z.string(),
    xunHead: z.object({ hour: z.string(), ke: z.string() }).strict(),
    kong: z.object({ hour: z.string(), ke: z.string() }).strict(),
    juDay: z.string(),
    ju: z.string(),
    jieqi: z.string(),
    zhifuZhishi,
    tianyi: z.string(),
    skyPlate: byPalace,
    earthPlate: byPalace,
    doors: byPalace,
    stars: byPalace,
    gods: byPalace,
    horses,
    angan: anganResult,
  })
  .strict();

export const goldenMirrorChartSchema = z
  .object({
    resolved: z.object({ datetime: civilDateTime }).strict(),
    ju: z.string(),
    dun: z.string(),
    dayPillar: z.string(),
    jieqi: z.string(),
    craneGod: z.array(z.string()).nullable(),
    stars: byPalace,
    doors: byPalace,
    gods: byPalace,
  })
  .strict();

export const zhirunRawSchema = z
  .object({
    jieqi: z.string(),
    daysFromJieqi: z.number().int(),
    sanyuan: z.string(),
    zhifuStem: z.string(),
    jieqiJu: z.string(),
    yinyang: z.string(),
    current: z.string(),
    chaoshen: z.string(),
    other: z.string(),
    other1: z.string(),
  })
  .strict();

/** `get_ju` returns both schools plus the 置閏 workings. */
export const juResultSchema = z
  .object({
    resolved: z.object({ datetime: civilDateTime }).strict(),
    jieqi: z.string(),
    dayPillar: z.string(),
    hourPillar: z.string(),
    kePillar: z.string(),
    chaibu: z.string(),
    zhirun: z.string(),
    ke: z.string(),
    zhirunWorkings: zhirunRawSchema,
  })
  .strict();

const patternResult = z.object({ gong: z.string().nullable() }).strict();

export const patternsResultSchema = z
  .object({
    resolved: z.object({ datetime: civilDateTime, method }).strict(),
    greenDragon: patternResult,
    flyingBird: patternResult,
    jadeGirl: patternResult,
  })
  .strict();

export const sixwuResultSchema = z
  .object({
    xunHead: z.string(),
    version: z.enum(["yanyi", "baojian"]),
    versionName: z.string(),
    wuBranch: z.string(),
    path: z.array(z.object({ step: z.number().int(), branch: z.string(), gong: z.string() }).strict()),
  })
  .strict();

export const resolveTimeResultSchema = z
  .object({
    datetime: z.string(),
    timezone: z.string(),
    civil: civilDateTime,
    note: z.string(),
  })
  .strict();

export const renderResultSchema = z.object({ text: z.string() }).strict();

const civilDate = z
  .object({ year: z.number().int(), month: z.number().int(), day: z.number().int() })
  .strict();

const patternName = z.enum(["greenDragon", "flyingBird", "jadeGirl"]);

const searchCriteria = z
  .object({
    palaces: z.array(z.string()).optional(),
    skyStems: z.array(z.string()).optional(),
    earthStems: z.array(z.string()).optional(),
    doors: z.array(z.string()).optional(),
    stars: z.array(z.string()).optional(),
    gods: z.array(z.string()).optional(),
    patterns: z.array(patternName).optional(),
  })
  .strict();

const searchMatch = z
  .object({
    datetime: civilDateTime,
    branch: z.string(),
    dayPillar: z.string(),
    hourPillar: z.string(),
    ju: z.string(),
    palace: z.string(),
    matched: z
      .object({
        skyStem: z.string().optional(),
        earthStem: z.string().optional(),
        door: z.string().optional(),
        star: z.string().optional(),
        god: z.string().optional(),
        patterns: z.array(patternName).optional(),
      })
      .strict(),
  })
  .strict();

export const searchResultSchema = z
  .object({
    resolved: z
      .object({
        start: civilDate,
        end: civilDate.optional(),
        direction: z.enum(["forward", "backward"]),
        method,
        criteria: searchCriteria,
        limit: z.number().int(),
        maxDays: z.number().int(),
      })
      .strict(),
    matches: z.array(searchMatch),
    returned: z.number().int(),
    limitReached: z.boolean(),
    budgetExhausted: z.boolean(),
    scannedThrough: civilDate,
    scannedShichen: z.number().int(),
  })
  .strict();

/**
 * The SDK wants the output schema as a raw shape, not a `ZodObject`. Strict
 * objects survive the round trip; this only unwraps the outer layer.
 */
export function shapeOf<T extends z.ZodObject<z.ZodRawShape>>(schema: T): T["shape"] {
  return schema.shape;
}
