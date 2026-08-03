/**
 * The skill tells an agent which tools to call and which fields to read. If it
 * names something that does not exist, the agent follows it into a dead end and
 * the failure looks like the engine's fault.
 *
 * So: every tool name and every field path the skill mentions must be real.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildChart, buildGoldenMirrorChart, buildKeChart, lookupReference, patterns } from "@cka4913/qimen-core";

const SKILL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills", "qimen", "SKILL.md"),
  "utf8"
);

const TOOL_NAMES = [
  "resolve_time",
  "find_chart_times",
  "get_qimen_chart",
  "get_qimen_chart_minute",
  "get_golden_mirror_chart",
  "get_ju",
  "check_patterns",
  "get_closed_sixwu",
  "render_chart_text",
  "lookup_reference",
];

const sample = { year: 2024, month: 6, day: 15, hour: 14, minute: 30 };
const chart = buildChart(sample, "zhirun");
const keChart = buildKeChart(sample, "zhirun");
const golden = buildGoldenMirrorChart(sample);

/** Resolve a dotted path, tolerating one array index. */
function resolve(root: unknown, path: string): unknown {
  return path.split(".").reduce<any>((acc, part) => {
    if (acc === undefined || acc === null) return undefined;
    const index = part.match(/^(\w+)\[(\d+)\]$/);
    return index ? acc[index[1] as string]?.[Number(index[2])] : acc[part];
  }, root);
}

describe("SKILL.md is honest about the tools", () => {
  it("every backticked tool name it mentions exists", () => {
    const mentioned = [...SKILL.matchAll(/`(\w+)`/g)]
      .map((m) => m[1] as string)
      .filter(
        (name) =>
          name.startsWith("get_") ||
          name.startsWith("check_") ||
          name.startsWith("find_") ||
          name === "resolve_time" ||
          name === "lookup_reference" ||
          name === "render_chart_text"
      );
    expect(mentioned.length).toBeGreaterThan(5);
    for (const name of new Set(mentioned)) expect(TOOL_NAMES, `unknown tool ${name}`).toContain(name);
  });

  it("names every tool at least once, so none is silently unreachable", () => {
    for (const name of TOOL_NAMES) expect(SKILL, `SKILL.md never mentions ${name}`).toContain(name);
  });
});

describe("SKILL.md is honest about the chart fields", () => {
  const paths: Array<[string, unknown]> = [
    ["zhifuZhishi.zhifuStar", chart],
    ["zhifuZhishi.zhishiDoor", chart],
    ["pillars.day", chart],
    ["pillars.hour", chart],
    ["earthPlate", chart],
    ["skyPlate", chart],
    ["doors", chart],
    ["stars", chart],
    ["gods", chart],
    ["horses.yiMa", chart],
    ["kong", chart],
    ["kong", keChart],
    ["craneGod", golden],
  ];

  it("every field path it tells an agent to read resolves on a real chart", () => {
    for (const [path, root] of paths) {
      expect(resolve(root, path), `SKILL.md points at ${path}, which does not resolve`).toBeDefined();
    }
  });

  it("the field paths it mentions are actually written in the file", () => {
    for (const [path] of paths) {
      const head = path.split(".")[0] as string;
      expect(SKILL, `SKILL.md documents no use of ${head}`).toContain(head);
    }
  });
});

describe("SKILL.md is honest about the facts it states", () => {
  it("中宮 really has no gate", () => {
    expect(chart.doors["中"]).toBeUndefined();
  });

  it("check_patterns really returns exactly the three named patterns", () => {
    expect(Object.keys(patterns(sample, "zhirun")).sort()).toEqual(["flyingBird", "greenDragon", "jadeGirl"]);
  });

  it("lookup_reference really carries palace directions and seasonal strength", () => {
    expect(lookupReference("palace", "離")["direction"]).toBe("南");
    expect(lookupReference("jieqi", "芒種")["season"]).toBe("夏");
  });

  it("23:00 really rolls the day pillar over", () => {
    const before = buildChart({ year: 2024, month: 6, day: 15, hour: 22, minute: 59 }, "zhirun");
    const after = buildChart({ year: 2024, month: 6, day: 15, hour: 23, minute: 1 }, "zhirun");
    expect(before.pillars.day).not.toBe(after.pillars.day);
  });

  it("刻家's kong really is the hour and 刻 pair, not the day and hour pair", () => {
    expect(Object.keys(keChart.kong).sort()).toEqual(["hour", "ke"]);
    expect(Object.keys(chart.kong).sort()).toEqual(["day", "hour"]);
  });
});
