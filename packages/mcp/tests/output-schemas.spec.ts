/**
 * The output schemas are validated by the SDK on every successful call, so a
 * schema that is subtly wrong turns into a protocol error for real users. This
 * runs real engine output through them over a spread of inputs, including the
 * awkward shapes: 值符 in 中宮 (which leaves the sky plate eight palaces wide),
 * 23:00 (which rolls the day over), and both schools.
 */
import { describe, expect, it } from "vitest";
import {
  buildChart,
  buildGoldenMirrorChart,
  buildKeChart,
  closedSixwuForXun,
  patterns,
  zhirunRaw,
  type CivilDateTime,
  type Method,
} from "@kinqimen/core";
import {
  goldenMirrorChartSchema,
  keChartSchema,
  patternsResultSchema,
  qimenChartSchema,
  sixwuResultSchema,
  zhirunRawSchema,
} from "../src/output-schemas.js";

/** A spread wide enough to hit every branch of the plate code. */
const SAMPLES: CivilDateTime[] = [];
for (const [year, month, day] of [
  [1900, 1, 15],
  [1984, 2, 4],
  [2020, 9, 22],
  [2024, 6, 15],
  [2024, 12, 21],
  [2025, 3, 20],
  [2078, 11, 7],
] as const) {
  for (const hour of [0, 5, 11, 17, 23]) {
    for (const minute of [0, 7, 35, 59]) {
      SAMPLES.push({ year, month, day, hour, minute });
    }
  }
}

const METHODS: Method[] = ["chaibu", "zhirun"];

describe("output schemas accept real engine output", () => {
  it("時家 charts", () => {
    for (const dt of SAMPLES) {
      for (const method of METHODS) {
        const parsed = qimenChartSchema.safeParse(buildChart(dt, method));
        expect(parsed.success ? null : parsed.error.issues, JSON.stringify(dt)).toBeNull();
      }
    }
  });

  it("刻家 charts", () => {
    for (const dt of SAMPLES) {
      for (const method of METHODS) {
        const parsed = keChartSchema.safeParse(buildKeChart(dt, method));
        expect(parsed.success ? null : parsed.error.issues, JSON.stringify(dt)).toBeNull();
      }
    }
  });

  it("金函玉鏡 charts", () => {
    for (const dt of SAMPLES) {
      const parsed = goldenMirrorChartSchema.safeParse(buildGoldenMirrorChart(dt));
      expect(parsed.success ? null : parsed.error.issues, JSON.stringify(dt)).toBeNull();
    }
  });

  it("置閏 workings and 格局", () => {
    for (const dt of SAMPLES) {
      expect(zhirunRawSchema.safeParse(zhirunRaw(dt)).success, JSON.stringify(dt)).toBe(true);
      for (const method of METHODS) {
        const result = { resolved: { datetime: dt, method }, ...patterns(dt, method) };
        expect(patternsResultSchema.safeParse(result).success, JSON.stringify(dt)).toBe(true);
      }
    }
  });

  it("閉六戊 paths", () => {
    for (const xun of ["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"]) {
      for (const version of ["yanyi", "baojian"] as const) {
        expect(sixwuResultSchema.safeParse(closedSixwuForXun(xun, version)).success, xun).toBe(true);
      }
    }
  });
});

describe("the sky plate really does lose 中宮 sometimes", () => {
  it("the corpus of samples covers both shapes, so the schema is exercised on both", () => {
    const widths = new Set<number>();
    for (const dt of SAMPLES) {
      for (const method of METHODS) widths.add(Object.keys(buildChart(dt, method).skyPlate).length);
    }
    expect([...widths].sort()).toEqual([8, 9]);
  });
});
