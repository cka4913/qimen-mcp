import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ENGINE_VERSION } from "@kinqimen/core";
import { registerGoldenMirror, registerJu, registerKeChart, registerQimenChart } from "./tools/charts.js";
import { registerLookup, registerPatterns, registerRenderText, registerResolveTime, registerSixwu } from "./tools/misc.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "kinqimen-mcp", version: ENGINE_VERSION });

  registerResolveTime(server);
  registerQimenChart(server);
  registerKeChart(server);
  registerGoldenMirror(server);
  registerJu(server);
  registerPatterns(server);
  registerSixwu(server);
  registerRenderText(server);
  registerLookup(server);

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`kinqimen-mcp v${ENGINE_VERSION} listening on stdio`);
}
