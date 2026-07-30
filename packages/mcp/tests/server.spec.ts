/**
 * End-to-end tests over the real MCP protocol: an in-memory client talks to the
 * real server, so tool registration, zod schemas and the two error channels are
 * all exercised the way a client would hit them.
 *
 * Every tool gets both a success path and a failure path here. The parity suites
 * prove the *numbers* are right; this proves the tools are reachable, that their
 * arguments are validated, and that each documented error code has a caller-
 * reachable path — which is where the last review found four holes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client.close();
});

/** Call a tool and parse the JSON payload it returns. */
async function call(name: string, args: Record<string, unknown>) {
  const res = (await client.callTool({ name, arguments: args })) as {
    content: Array<{ type: string; text: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  return { isError: !!res.isError, data: JSON.parse(res.content[0]!.text), structured: res.structuredContent };
}

/** A moment with a known chart, used as the happy path everywhere. */
const WHEN = "2024-06-15T14:30";

const ALL_TOOLS = [
  "check_patterns",
  "get_closed_sixwu",
  "get_golden_mirror_chart",
  "get_ju",
  "get_qimen_chart",
  "get_qimen_chart_minute",
  "lookup_reference",
  "render_chart_text",
  "resolve_time",
];

describe("tool registration", () => {
  it("exposes exactly the documented tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(ALL_TOOLS);
  });

  it("gives every tool a title and a description worth reading", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.title ?? (tool as any).annotations?.title, tool.name).toBeTruthy();
      expect(tool.description?.length ?? 0, tool.name).toBeGreaterThan(40);
    }
  });

  it("declares no argument this server does not read", async () => {
    // A schema that advertises an option the handler ignores is worse than no
    // option: an agent sets it, sees no change, and cannot tell why.
    const { tools } = await client.listTools();
    const declared = Object.fromEntries(
      tools.map((t) => [t.name, Object.keys((t.inputSchema as any).properties ?? {}).sort()])
    );
    expect(declared["get_qimen_chart"]).toEqual(["datetime", "method"]);
    expect(declared["get_qimen_chart_minute"]).toEqual(["datetime", "method"]);
    expect(declared["get_golden_mirror_chart"]).toEqual(["datetime"]);
    expect(declared["get_ju"]).toEqual(["datetime"]);
    expect(declared["check_patterns"]).toEqual(["datetime", "method"]);
    expect(declared["get_closed_sixwu"]).toEqual(["datetime", "version", "xunHead"]);
    expect(declared["render_chart_text"]).toEqual(["datetime", "method", "style"]);
    expect(declared["lookup_reference"]).toEqual(["category", "key"]);
    expect(declared["resolve_time"]).toEqual(["timezone"]);
  });
});

describe("every tool serves its happy path", () => {
  it("get_qimen_chart", async () => {
    const { isError, data, structured } = await call("get_qimen_chart", { datetime: WHEN, method: "zhirun" });
    expect(isError).toBe(false);
    expect(data.ju).toBe("陽遁六局上元");
    expect(data.jieqi).toBe("芒種");
    expect(data.resolved.datetime).toEqual({ year: 2024, month: 6, day: 15, hour: 14, minute: 30 });
    expect(structured, "clients should not have to parse text").toBeDefined();
  });

  it("get_qimen_chart_minute", async () => {
    const { isError, data } = await call("get_qimen_chart_minute", { datetime: WHEN, method: "zhirun" });
    expect(isError).toBe(false);
    expect(data.pillars.ke).toBe("辛酉");
    expect(data.angan.flying).toBeTruthy();
    expect(Object.keys(data.kong).sort()).toEqual(["hour", "ke"]);
  });

  it("get_golden_mirror_chart", async () => {
    const { isError, data } = await call("get_golden_mirror_chart", { datetime: WHEN });
    expect(isError).toBe(false);
    expect(data.ju).toBe("陽遁庚戌日");
    expect(data.doors["中"]).toBe("");
  });

  it("get_ju", async () => {
    const { isError, data } = await call("get_ju", { datetime: WHEN });
    expect(isError).toBe(false);
    expect(data.chaibu).toBe("陽遁六局上");
    expect(data.zhirun).toBe("陽遁六局上元");
    expect(data.zhirunWorkings.daysFromJieqi).toBeTypeOf("number");
  });

  it("check_patterns", async () => {
    const { isError, data } = await call("check_patterns", { datetime: WHEN, method: "zhirun" });
    expect(isError).toBe(false);
    for (const key of ["greenDragon", "flyingBird", "jadeGirl"]) {
      expect(data[key], key).toHaveProperty("gong");
    }
  });

  it("get_closed_sixwu, by datetime", async () => {
    const { isError, data } = await call("get_closed_sixwu", { datetime: WHEN, version: "yanyi" });
    expect(isError).toBe(false);
    expect(data.xunHead).toBe("甲戌");
    expect(data.path).toHaveLength(7);
  });

  it("get_closed_sixwu, by xunHead", async () => {
    const { isError, data } = await call("get_closed_sixwu", { xunHead: "甲子", version: "baojian" });
    expect(isError).toBe(false);
    expect(data.path.map((s: any) => s.branch)).toEqual(["辰", "午", "申", "戌", "子", "寅", "辰"]);
  });

  it("render_chart_text, all three styles", async () => {
    for (const [style, marker] of [
      ["hour", "時家奇門"],
      ["minute", "刻家奇門"],
      ["golden", "金函玉鏡"],
    ] as const) {
      const { isError, data } = await call("render_chart_text", { datetime: WHEN, method: "zhirun", style });
      expect(isError, style).toBe(false);
      expect(data.text, style).toContain(marker);
      expect(data.text, style).toContain("坎");
    }
  });

  it("lookup_reference, every category", async () => {
    for (const [category, key] of [
      ["door", "生"],
      ["star", "天蓬"],
      ["god", "值符"],
      ["stem", "乙"],
      ["branch", "子"],
      ["palace", "離"],
      ["jieqi", "芒種"],
    ] as const) {
      const { isError, data } = await call("lookup_reference", { category, key });
      expect(isError, `${category}/${key}`).toBe(false);
      expect(data.category, `${category}/${key}`).toBe(category);
      expect(data.name, `${category}/${key}`).toBeTruthy();
    }
  });

  it("lookup_reference lists a category's keys when given no key", async () => {
    const { isError, data } = await call("lookup_reference", { category: "door" });
    expect(isError).toBe(false);
    expect(data.keys).toHaveLength(8);
  });

  it("resolve_time", async () => {
    const { isError, data } = await call("resolve_time", { timezone: "Asia/Hong_Kong" });
    expect(isError).toBe(false);
    expect(data.timezone).toBe("Asia/Hong_Kong");
    expect(data.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // The whole point of the tool: its answer is shaped to be passed straight back.
    const { isError: chartErred } = await call("get_qimen_chart", { datetime: data.datetime, method: "chaibu" });
    expect(chartErred).toBe(false);
  });
});

describe("business errors carry a code an agent can branch on", () => {
  it("DATETIME_OUT_OF_RANGE for a year outside the solar-term table", async () => {
    const { isError, data } = await call("get_qimen_chart", { datetime: "1850-01-01T12:00", method: "chaibu" });
    expect(isError).toBe(true);
    expect(data.error.code).toBe("DATETIME_OUT_OF_RANGE");
  });

  it("DATETIME_INVALID for a date that does not exist", async () => {
    // Regression: these used to be accepted, normalised to another day, and
    // charted — while `resolved` still echoed the impossible date.
    for (const datetime of ["2024-02-30T12:00", "2024-04-31T12:00", "2023-02-29T12:00"]) {
      const { isError, data } = await call("get_qimen_chart", { datetime, method: "chaibu" });
      expect(isError, datetime).toBe(true);
      expect(data.error.code, datetime).toBe("DATETIME_INVALID");
    }
  });

  it("accepts the leap day that does exist", async () => {
    const { isError } = await call("get_qimen_chart", { datetime: "2024-02-29T12:00", method: "chaibu" });
    expect(isError).toBe(false);
  });

  it("ARGUMENT_REQUIRED when get_closed_sixwu is given neither selector", async () => {
    const { isError, data } = await call("get_closed_sixwu", { version: "yanyi" });
    expect(isError).toBe(true);
    // Not INTERNAL_ERROR: the call was wrong, the server was not.
    expect(data.error.code).toBe("ARGUMENT_REQUIRED");
  });

  it("TIMEZONE_INVALID for an unknown IANA zone", async () => {
    const { isError, data } = await call("resolve_time", { timezone: "Mars/Olympus_Mons" });
    expect(isError).toBe(true);
    expect(data.error.code).toBe("TIMEZONE_INVALID");
  });

  it("UNKNOWN_REFERENCE_KEY for a term that is not in the dictionary", async () => {
    const { isError, data } = await call("lookup_reference", { category: "door", key: "冇呢道門" });
    expect(isError).toBe(true);
    expect(data.error.code).toBe("UNKNOWN_REFERENCE_KEY");
  });

  it("never reports a caller's mistake as INTERNAL_ERROR", async () => {
    const badCalls: Array<[string, Record<string, unknown>]> = [
      ["get_qimen_chart", { datetime: "1850-01-01T12:00", method: "chaibu" }],
      ["get_qimen_chart", { datetime: "2024-02-30T12:00", method: "chaibu" }],
      ["get_closed_sixwu", { version: "yanyi" }],
      ["resolve_time", { timezone: "Mars/Olympus_Mons" }],
      ["lookup_reference", { category: "star", key: "唔存在" }],
      ["get_golden_mirror_chart", { datetime: "2200-01-01T00:00" }],
    ];
    for (const [name, args] of badCalls) {
      const { data } = await call(name, args);
      expect(data.error?.code, `${name} ${JSON.stringify(args)}`).not.toBe("INTERNAL_ERROR");
    }
  });
});

describe("malformed arguments come back as a -32602 validation error", () => {
  const malformed: Array<[string, Record<string, unknown>]> = [
    ["get_qimen_chart", { datetime: "not a date", method: "chaibu" }],
    ["get_qimen_chart", { datetime: WHEN, method: "no-such-school" }],
    ["get_qimen_chart", {}],
    ["render_chart_text", { datetime: WHEN, method: "chaibu", style: "sideways" }],
    ["lookup_reference", { category: "not-a-category" }],
    ["get_closed_sixwu", { xunHead: "甲丑", version: "yanyi" }],
  ];

  for (const [name, args] of malformed) {
    it(`${name} ${JSON.stringify(args)}`, async () => {
      const res = (await client.callTool({ name, arguments: args })) as {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
      };
      // The zod schema rejects these before the handler runs. The SDK reports
      // that as -32602, but delivers it as an `isError` result carrying a plain
      // sentence — *not* as a rejected promise, and not in this engine's
      // `{ error: { code } }` shape. A client that blindly JSON.parses an error
      // body will throw here, which is why the distinction is documented.
      expect(res.isError).toBe(true);
      expect(res.content[0]!.text).toContain("-32602");
      expect(() => JSON.parse(res.content[0]!.text)).toThrow();
    });
  }

  it("business errors, by contrast, are always parseable JSON with a code", async () => {
    const res = (await client.callTool({
      name: "get_qimen_chart",
      arguments: { datetime: "1850-01-01T12:00", method: "chaibu" },
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0]!.text).error.code).toBe("DATETIME_OUT_OF_RANGE");
  });

  it("keeps serving after a rejected call", async () => {
    await client.callTool({ name: "get_qimen_chart", arguments: {} });
    const { isError, data } = await call("get_qimen_chart", { datetime: WHEN, method: "chaibu" });
    expect(isError).toBe(false);
    expect(data.jieqi).toBe("芒種");
  });
});

describe("results are immutable", () => {
  it("a chart cannot be mutated, so one caller cannot poison another's", async () => {
    // Regression: the memo caches share sub-objects between callers. A caller
    // that mutated one used to change every later chart for the same moment.
    const { buildChart } = await import("@cka4913/qimen-core");
    const first = buildChart({ year: 2024, month: 6, day: 15, hour: 14, minute: 30 }, "zhirun");
    expect(() => {
      (first.skyPlate as Record<string, string>)["坤"] = "XXX";
    }).toThrow(TypeError);
    const second = buildChart({ year: 2024, month: 6, day: 15, hour: 14, minute: 30 }, "zhirun");
    expect(second.skyPlate["坤"]).toBe(first.skyPlate["坤"]);
    expect(Object.isFrozen(second.earthPlate)).toBe(true);
  });
});
