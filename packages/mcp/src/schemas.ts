import { z } from "zod";
import { MAX_YEAR, MIN_YEAR, type CivilDateTime, type Method } from "@kinqimen/core";

/**
 * Every time-dependent tool takes this. It is a *civil* datetime: the wall
 * clock where the question is being asked. The engine applies no timezone, no
 * DST rule and no 真太陽時 correction, and it never reads the server clock — if
 * you want "now", call `resolve_time` first and pass its answer back.
 */
export const datetimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, "expected YYYY-MM-DDTHH:mm")
  .describe(
    `起盤時間，格式 "YYYY-MM-DDTHH:mm"（秒會被忽略）。呢個係當地民用時間（wall clock）：` +
      `引擎唔做時區轉換、唔做日光節約、唔做真太陽時校正，亦都唔會自己讀系統時鐘。` +
      `要用「而家」就先 call resolve_time，再將佢個結果明文傳返入嚟。` +
      `支援範圍 ${MIN_YEAR}–${MAX_YEAR} 年。注意 23:00 起計為第二日子時（晚子時）。`
  );

export const methodSchema = z
  .enum(["chaibu", "zhirun"])
  .describe(
    "排局法：chaibu（拆補法）以日柱定三元、節氣定局，無特例；" +
      "zhirun（置閏法）按距節氣日數判超神／正授／接氣／閏奇。" +
      "兩派結論會唔同，冇邊個係「正確」——揀邊派要用戶自己決定，唔好幫佢揀。"
  );

export const sixwuVersionSchema = z
  .enum(["yanyi", "baojian"])
  .describe("閉六戊法版本：yanyi（演義版，逆布連土）或 baojian（寶鑑版，順布連土）。兩個傳承方向相反。");

export const datetimeShape = { datetime: datetimeSchema };
// No `glossary` here on purpose. A chart repeats the same eight gates and nine
// stars across nine palaces, so attaching a gloss to each one burns tokens to
// say the same thing nine times. `lookup_reference` answers "what is 生門"
// once, which is how often the question actually gets asked.
export const chartShape = { datetime: datetimeSchema, method: methodSchema };

/** Parse the validated string into the engine's shape. Never throws for a value that passed the schema. */
export function toCivilDateTime(value: string): CivilDateTime {
  const [date, time] = value.replace(" ", "T").split("T") as [string, string];
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return { year, month, day, hour, minute };
}

export type { Method };
