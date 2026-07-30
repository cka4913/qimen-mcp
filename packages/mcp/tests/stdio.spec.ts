/**
 * Smoke test against the *real* compiled entry point, spawned as a subprocess
 * over stdio — the way every MCP client actually launches it.
 *
 * server.spec.ts covers tool behaviour through an in-memory transport, which
 * says nothing about whether `dist/index.js` exists, starts, keeps stdout free
 * of stray output, or exits cleanly. Those are exactly the failures a user hits
 * at install time.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface, type Interface } from "node:readline";

const ENTRY = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const PKG = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));

let child: ChildProcessWithoutNullStreams;
let lines: Interface;
let stderr = "";
let serverInfo: any;
const inbox: any[] = [];
let nextId = 1;

function request(method: string, params?: unknown): Promise<any> {
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 10_000);
    const poll = setInterval(() => {
      const hit = inbox.find((m) => m.id === id);
      if (hit) {
        clearInterval(poll);
        clearTimeout(timer);
        resolve(hit);
      }
    }, 10);
  });
}

beforeAll(async () => {
  expect(existsSync(ENTRY), `${ENTRY} missing — run \`pnpm build\` first`).toBe(true);

  child = spawn(process.execPath, [ENTRY], { stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.on("data", (chunk) => (stderr += String(chunk)));

  lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    if (line.trim()) inbox.push(JSON.parse(line));
  });

  await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "stdio-smoke", version: "0" },
  }).then((init) => {
    serverInfo = init.result.serverInfo;
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
}, 20_000);

afterAll(() => {
  lines?.close();
  child?.kill();
});

describe("compiled entry point", () => {
  it("is declared as the package bin and carries a shebang", () => {
    expect(PKG.bin).toHaveProperty("qimen-mcp");
    expect(readFileSync(ENTRY, "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
  });

  it("announces itself on stderr, never on stdout", () => {
    // stdout is the JSON-RPC channel; one stray console.log corrupts the stream.
    expect(stderr).toContain("qimen-mcp");
    expect(stderr).toContain("listening on stdio");
    for (const message of inbox) expect(message.jsonrpc).toBe("2.0");
  });

  it("reports serverInfo.name as qimen-mcp on initialize", () => {
    expect(serverInfo?.name).toBe("qimen-mcp");
  });
});

describe("tools over a real pipe", () => {
  it("lists all nine tools", async () => {
    const { result } = await request("tools/list");
    expect(result.tools.map((t: any) => t.name).sort()).toEqual([
      "check_patterns",
      "get_closed_sixwu",
      "get_golden_mirror_chart",
      "get_ju",
      "get_qimen_chart",
      "get_qimen_chart_minute",
      "lookup_reference",
      "render_chart_text",
      "resolve_time",
    ]);
  });

  it("publishes a JSON Schema for the input of every tool", async () => {
    const { result } = await request("tools/list");
    for (const tool of result.tools) {
      expect(tool.inputSchema, tool.name).toBeDefined();
      expect(tool.description?.length ?? 0, `${tool.name} needs a description`).toBeGreaterThan(40);
    }
  });

  it("publishes an output schema for every tool that returns a fixed shape", async () => {
    // The point of declaring outputSchema is that a client can read the contract
    // from metadata; that only holds if it survives conversion to JSON Schema.
    // `lookup_reference` is the one exception: its payload differs per category.
    const { result } = await request("tools/list");
    for (const tool of result.tools) {
      if (tool.name === "lookup_reference") continue;
      expect(tool.outputSchema, `${tool.name} must declare an output schema`).toBeDefined();
      expect(tool.outputSchema.type, tool.name).toBe("object");
      expect(Object.keys(tool.outputSchema.properties ?? {}).length, tool.name).toBeGreaterThan(0);
    }
  });

  it("builds a chart end to end", async () => {
    const { result } = await request("tools/call", {
      name: "get_qimen_chart",
      arguments: { datetime: "2024-06-15T14:30", method: "zhirun" },
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.ju).toBe("陽遁六局上元");
    expect(data.pillars.day).toBe("庚戌");
    expect(data.earthPlate["中"]).toBe("乙");
  });

  it("delivers the payload as structured content too", async () => {
    const { result } = await request("tools/call", {
      name: "get_ju",
      arguments: { datetime: "2024-06-15T14:30" },
    });
    expect(result.structuredContent, "clients should not have to parse text").toBeDefined();
    expect(result.structuredContent.chaibu).toBe(JSON.parse(result.content[0].text).chaibu);
  });

  it("returns business errors as a JSON body with a code", async () => {
    const { result } = await request("tools/call", {
      name: "get_qimen_chart",
      arguments: { datetime: "1850-01-01T12:00", method: "chaibu" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error.code).toBe("DATETIME_OUT_OF_RANGE");
  });

  it("survives a malformed-argument call and keeps serving", async () => {
    await request("tools/call", { name: "get_qimen_chart", arguments: { datetime: "not a date" } });
    const { result } = await request("tools/call", {
      name: "get_qimen_chart",
      arguments: { datetime: "2024-06-15T14:30", method: "chaibu" },
    });
    expect(result.isError, "server must stay healthy after a bad call").toBeFalsy();
    expect(JSON.parse(result.content[0].text).jieqi).toBe("芒種");
  });
});

describe("shutdown", () => {
  it("exits when its stdin closes", async () => {
    const solo = spawn(process.execPath, [ENTRY], { stdio: ["pipe", "pipe", "pipe"] });
    const exited = new Promise<number | null>((resolve) => solo.on("exit", (code) => resolve(code)));
    await new Promise((r) => setTimeout(r, 300));
    solo.stdin.end();
    const code = await Promise.race([
      exited,
      new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 5_000)),
    ]);
    expect(code, "a client disconnect must not leave a zombie process").not.toBe("timeout");
    solo.kill();
  }, 10_000);
});
