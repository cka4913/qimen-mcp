import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ENGINE_VERSION } from "@cka4913/qimen-core";
import { registerGoldenMirror, registerJu, registerKeChart, registerQimenChart } from "./tools/charts.js";
import { registerLookup, registerPatterns, registerRenderText, registerResolveTime, registerSixwu } from "./tools/misc.js";
import { registerSearch } from "./tools/search.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "qimen-mcp", version: ENGINE_VERSION });

  registerResolveTime(server);
  registerQimenChart(server);
  registerKeChart(server);
  registerGoldenMirror(server);
  registerJu(server);
  registerSearch(server);
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
  console.error(`qimen-mcp v${ENGINE_VERSION} listening on stdio`);
}
