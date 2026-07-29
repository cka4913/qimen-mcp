# Connecting kinqimen-mcp to a client · 接上 Hermes / Claude 等 client

> Practical setup for any MCP client that spawns stdio servers — Hermes, Claude Desktop, Claude Code, Codex, OpenCode. For the tool contract see [AI-AGENT-INTEGRATION.md](AI-AGENT-INTEGRATION.md); for interpretation see [SKILLS.md](SKILLS.md).
>
> 任何會 spawn stdio server 嘅 MCP client 嘅實務設定。工具契約見 [AI-AGENT-INTEGRATION.md](AI-AGENT-INTEGRATION.md)，解讀流程見 [SKILLS.md](SKILLS.md)。

---

## 1. Install and build · 安裝與編譯

**EN** — This is a stdio MCP server: the client launches it as a subprocess, so it must be built to `dist/` first.

**中** — 呢個係 stdio MCP server，client 會當 subprocess 啟動，所以要先編譯到 `dist/`。

```sh
git clone https://github.com/cka4913/kinqimen-mcp.git
cd kinqimen-mcp
pnpm install
pnpm build          # produces packages/mcp/dist/index.js
pnpm test           # optional
```

Requires Node ≥ 22. No Python, no native extensions, no network, no API keys.

**EN** — Confirm the entry point starts. It logs to **stderr** and then waits on stdin — no output on stdout until a client speaks to it, which is correct for stdio transport.

**中** — 確認 entry point 啟動到。佢寫 stderr 之後就等 stdin——client 未講嘢之前 stdout 唔會有嘢，呢個係 stdio transport 嘅正常行為。

```sh
node packages/mcp/dist/index.js
# kinqimen-mcp v0.1.0 listening on stdio
# (Ctrl-C to exit)
```

---

## 2. Client configuration · Client 設定

**EN** — Use an **absolute path** to `packages/mcp/dist/index.js`. Clients do not resolve relative paths against your shell's working directory.

**中** — 用 `packages/mcp/dist/index.js` 嘅**絕對路徑**。Client 唔會用你 shell 嘅工作目錄去解析相對路徑。

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "kinqimen": {
      "command": "node",
      "args": ["/absolute/path/to/kinqimen-mcp/packages/mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop after editing. The nine tools appear under the tools menu.

### Claude Code

```sh
claude mcp add kinqimen -- node /absolute/path/to/kinqimen-mcp/packages/mcp/dist/index.js
```

Check with `claude mcp list`, then `/mcp` inside a session.

### Any other stdio client

Same two fields everywhere: `command: "node"` and one argument, the absolute path to `packages/mcp/dist/index.js`. There are no environment variables to set.

---

## 3. Installing the skill · 安裝解讀 skill

**EN** — The server returns facts; [`skills/kinqimen/SKILL.md`](../skills/kinqimen/SKILL.md) is what turns them into a reading. Copy it where your client looks for skills:

**中** — Server 只回事實，[`skills/kinqimen/SKILL.md`](../skills/kinqimen/SKILL.md) 先係將事實變成解讀嗰份嘢。抄去你 client 搵 skill 嘅位置：

```sh
# Claude Code, project-scoped
mkdir -p .claude/skills
cp -r /path/to/kinqimen-mcp/skills/kinqimen .claude/skills/

# Claude Code, user-scoped
cp -r /path/to/kinqimen-mcp/skills/kinqimen ~/.claude/skills/
```

Without it the tools still work, but the agent has to invent its own reading procedure — which is exactly what the skill exists to prevent.

---

## 4. Smoke test · 試機

Ask the client something that forces a real call:

> 幫我起 2024 年 6 月 15 日下午 2:30 嘅時家奇門盤，用置閏法。

You should see `get_qimen_chart` called with `datetime: "2024-06-15T14:30"` and `method: "zhirun"`, coming back with 排局 `陽遁六局上元`, 節氣 `芒種`, day pillar `庚戌`.

Then check the clock discipline:

> 而家嘅奇門盤點？

The agent should call `resolve_time` **first**, then pass its `datetime` into `get_qimen_chart`. If it calls `get_qimen_chart` with a datetime it made up, the skill is not loaded.

---

## 5. Troubleshooting · 疑難

| Symptom | Cause |
|---|---|
| Client shows no tools | `dist/` not built — run `pnpm build` |
| `Cannot find module` on start | Relative path in the config; use an absolute one |
| `DATETIME_OUT_OF_RANGE` | Year outside 1900–2100, the span of the solar-term table |
| `DATETIME_INVALID` | Datetime string not `YYYY-MM-DDTHH:mm` |
| Charts differ from kinqimen's website | Check the 排局法 first (拆補 vs 置閏), then see [PORTING-NOTES.md](PORTING-NOTES.md) — dates from 2079-06-06 onward differ deliberately |
| Agent invents the current time | The skill is not installed |
