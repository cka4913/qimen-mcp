# 連接 kinqimen-mcp 至 client

> 工具契約見 [AI-AGENT-INTEGRATION.md](AI-AGENT-INTEGRATION.md)；解讀流程見 [SKILLS.md](SKILLS.md)。

本文件說明如何將 kinqimen-mcp 連接至任何支援 stdio transport 的 MCP client，包括 Claude Desktop、Claude Code、Hermes、Codex、OpenCode 等。

---

## 1. 安裝與編譯

本 server 以 stdio 方式運作：client 會將其當作 subprocess 啟動，因此必須先編譯至 `dist/`。

```sh
git clone https://github.com/cka4913/kinqimen-mcp.git
cd kinqimen-mcp
pnpm install
pnpm build          # 產生 packages/mcp/dist/index.js
pnpm test           # 選用
```

需要 Node.js ≥ 22。不需要 Python、原生擴充套件、網路連線或 API key。

確認 entry point 可以啟動。程式會將訊息寫入 **stderr**，然後等待 stdin——在 client 送出訊息之前，stdout 不會有任何輸出，此為 stdio transport 的正常行為：

```sh
node packages/mcp/dist/index.js
# kinqimen-mcp v0.1.0 listening on stdio
# (按 Ctrl-C 結束)
```

---

## 2. Client 設定

請使用 `packages/mcp/dist/index.js` 的**絕對路徑**。Client 不會以你 shell 的工作目錄去解析相對路徑。

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）：

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

編輯後重新啟動 Claude Desktop，九個 tool 會出現在 tools 選單中。

### Claude Code

```sh
claude mcp add kinqimen -- node /absolute/path/to/kinqimen-mcp/packages/mcp/dist/index.js
```

以 `claude mcp list` 確認已加入，並在 session 內以 `/mcp` 檢查連線狀態。

### 其他 stdio client

設定方式一致：`command` 設為 `"node"`，唯一參數為 `packages/mcp/dist/index.js` 的絕對路徑。不需要設定任何環境變數。

---

## 3. 安裝解讀 skill

Server 只回傳事實；將事實轉化為解讀的是 [`skills/kinqimen/SKILL.md`](../skills/kinqimen/SKILL.md)。請將其複製至你 client 讀取 skill 的位置：

```sh
# Claude Code，專案層級
mkdir -p .claude/skills
cp -r /path/to/kinqimen-mcp/skills/kinqimen .claude/skills/

# Claude Code，使用者層級
cp -r /path/to/kinqimen-mcp/skills/kinqimen ~/.claude/skills/
```

未安裝 skill 的情況下 tool 仍可正常運作，但 agent 需自行編造解讀程序——安裝 skill 正是為了避免這種情況。

---

## 4. 連線測試

向 client 提出一個會觸發實際呼叫的問題：

> 幫我起 2024 年 6 月 15 日下午 2:30 的時家奇門盤，用置閏法。

應可見到 `get_qimen_chart` 以 `datetime: "2024-06-15T14:30"`、`method: "zhirun"` 被呼叫，回傳結果為排局 `陽遁六局上元`、節氣 `芒種`、日柱 `庚戌`。

接著測試時鐘規則：

> 現在的奇門盤如何？

Agent 應**先**呼叫 `resolve_time`，再將其結果傳入 `get_qimen_chart`。若 agent 直接以自行編造的 datetime 呼叫 `get_qimen_chart`，代表 skill 未有正確載入。

---

## 5. 疑難排解

| 現象 | 原因 |
|---|---|
| Client 未顯示任何 tool | `dist/` 尚未編譯——執行 `pnpm build` |
| 啟動時出現 `Cannot find module` | 設定檔中使用了相對路徑；請改用絕對路徑 |
| `DATETIME_OUT_OF_RANGE` | 年份超出 1900–2100，此為節氣時刻表的涵蓋範圍 |
| `DATETIME_INVALID` | Datetime 字串格式不符 `YYYY-MM-DDTHH:mm`，或該日期不存在（例如 2024-02-30） |
| 排出的盤與 kinqimen 網站不同 | 先確認排局法是否一致（拆補 vs 置閏），再參閱 [PORTING-NOTES.md](PORTING-NOTES.md)——2079-06-06 之後的日期屬刻意偏離 |
| Agent 自行編造現在時間 | Skill 未安裝 |

---

<br>

---

<br>

# Connecting kinqimen-mcp to a client (English)

> For the tool contract see [AI-AGENT-INTEGRATION.md](AI-AGENT-INTEGRATION.md); for interpretation see [SKILLS.md](SKILLS.md).

This document covers connecting kinqimen-mcp to any MCP client that supports stdio transport, including Claude Desktop, Claude Code, Hermes, Codex, and OpenCode.

---

## 1. Install and build

This is a stdio MCP server: the client launches it as a subprocess, so it must be built to `dist/` first.

```sh
git clone https://github.com/cka4913/kinqimen-mcp.git
cd kinqimen-mcp
pnpm install
pnpm build          # produces packages/mcp/dist/index.js
pnpm test           # optional
```

Requires Node ≥ 22. No Python, no native extensions, no network, no API keys.

Confirm the entry point starts. It logs to **stderr** and then waits on stdin — no output on stdout until a client speaks to it, which is correct for stdio transport:

```sh
node packages/mcp/dist/index.js
# kinqimen-mcp v0.1.0 listening on stdio
# (Ctrl-C to exit)
```

---

## 2. Client configuration

Use an **absolute path** to `packages/mcp/dist/index.js`. Clients do not resolve relative paths against your shell's working directory.

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

## 3. Installing the skill

The server returns facts; [`skills/kinqimen/SKILL.md`](../skills/kinqimen/SKILL.md) is what turns them into a reading. Copy it where your client looks for skills:

```sh
# Claude Code, project-scoped
mkdir -p .claude/skills
cp -r /path/to/kinqimen-mcp/skills/kinqimen .claude/skills/

# Claude Code, user-scoped
cp -r /path/to/kinqimen-mcp/skills/kinqimen ~/.claude/skills/
```

Without it the tools still work, but the agent has to invent its own reading procedure — which is exactly what the skill exists to prevent.

---

## 4. Smoke test

Ask the client something that forces a real call:

> Chart the 時家奇門 for 2024-06-15 2:30pm, using the 置閏 method.

You should see `get_qimen_chart` called with `datetime: "2024-06-15T14:30"` and `method: "zhirun"`, coming back with 排局 `陽遁六局上元`, 節氣 `芒種`, day pillar `庚戌`.

Then check the clock discipline:

> What's today's Qi Men chart right now?

The agent should call `resolve_time` **first**, then pass its `datetime` into `get_qimen_chart`. If it calls `get_qimen_chart` with a datetime it made up, the skill is not loaded.

---

## 5. Troubleshooting

| Symptom | Cause |
|---|---|
| Client shows no tools | `dist/` not built — run `pnpm build` |
| `Cannot find module` on start | Relative path in the config; use an absolute one |
| `DATETIME_OUT_OF_RANGE` | Year outside 1900–2100, the span of the solar-term table |
| `DATETIME_INVALID` | Datetime string not `YYYY-MM-DDTHH:mm`, or the date does not exist (e.g. 2024-02-30) |
| Charts differ from kinqimen's website | Check the 排局法 first (拆補 vs 置閏), then see [PORTING-NOTES.md](PORTING-NOTES.md) — dates from 2079-06-06 onward differ deliberately |
| Agent invents the current time | The skill is not installed |
