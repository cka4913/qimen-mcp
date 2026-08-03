# qimen-mcp

> 奇門遁甲 deterministic facts engine，以 Model Context Protocol（MCP）工具形式提供給 AI agent 使用。

[![CI](https://github.com/cka4913/qimen-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/cka4913/qimen-mcp/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/cka4913/qimen-mcp/releases)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-%5E1.29-000000)](https://github.com/modelcontextprotocol/typescript-sdk)
[![License: MIT](https://img.shields.io/github/license/cka4913/qimen-mcp)](LICENSE)

> MCP protocol 版本由 `@modelcontextprotocol/sdk` 於連線時自動協商，本專案不自行釘死單一 protocol 版本。目前開發與測試以 `2024-11-05` initialize 進行驗證。

---

## 專案簡介

`qimen-mcp` 是奇門遁甲（時家、刻家、金函玉鏡）的 deterministic 計算引擎，以純 TypeScript 實作，並透過 stdio MCP server 對外提供結構化的盤面資料。

呼叫任何一個排盤 tool，得到的是一組事實：天地兩盤各宮位配置何種天干、值符值使落在哪個宮位、九星八門八神的排列、旬空與馬星、每個宮位的十二長生階段（四維宮兩支各一，故為列表）。**引擎本身不做吉凶判斷，亦不產生敘述性解讀**——這部分屬於呼叫端 agent 的責任。專案隨附 [`skills/qimen/SKILL.md`](skills/qimen/SKILL.md)，作為 agent 進行解讀時的參考流程，但該文件所載的取用神與格局判斷屬於未經流派校訂的草稿，使用前應自行核實。

本專案由 [kentang2017/kinqimen](https://github.com/kentang2017/kinqimen)（Python 實作，附 Streamlit 前端）移植而成。上游 repository 未有改動；本專案抽取其計算邏輯，移除 UI 與報告產生器，並以 `lunar-javascript` 取代 `sxtwl`／`ephem` 兩個原生擴充套件。移植的忠實度並非單憑聲稱，而是透過測試逐欄驗證——詳見下方「測試與可信度」一節。

---

## 主要功能

| 系統 | 說明 |
|---|---|
| 時家奇門 | 以時辰起盤，支援拆補法與置閏法兩派 |
| 刻家奇門 | 以十分鐘為單位的精細起盤，附暗干與飛干 |
| 金函玉鏡 | 日家起盤，只需日期，不需時辰 |
| 排局 | 獨立查詢兩派局名，連同置閏法的完整推導過程 |
| 格局判定 | 青龍返首、飛鳥跌穴、玉女守門三個格局的事實檢測 |
| 真人閉六戊法 | 法術奇門路徑計算（演義版／寶鑑版） |
| 文字盤 | 九宮方格文字視圖，方便直接呈現 |
| 名詞查詢 | 八門、九星、八神、天干地支、九宮、節氣的屬性字典 |
| 找局 | 依盤面條件搜尋符合的時辰，用於擇時；條件須同宮成立 |

---

## 為何使用此專案／設計原則

1. **Deterministic** — 相同輸入永遠得出相同輸出。引擎本身不讀取系統時鐘、不做時區轉換，亦不做日光節約或真太陽時校正。
2. **明文時間** — 所有涉及時間的查詢都必須明文傳入 `datetime`。全專案唯一會讀取系統時鐘的 tool 是 `resolve_time`，其結果需由呼叫端明文傳回其他 tool。
3. **無網路依賴** — 不連接任何外部服務，不需要 API key，不會有網路請求。
4. **事實與解讀分離** — Tool 只回傳盤面事實，不回傳吉凶判斷或敘述。解讀邏輯交由呼叫端 agent，並由隨附的 skill 文件提供程序性指引。
5. **兩派並存，不代為選擇** — 拆補法與置閏法會得出不同結論，兩者皆無「正確」與否之分。引擎兩者皆支援，並要求呼叫端明確指定，不會自行選擇。

---

## 架構

```
packages/
├─ core/       純計算引擎——曆法、干支、排局、天地盤、格局。無 I/O
├─ mcp/        stdio MCP server——10 個 tool、zod schema、錯誤映射
└─ fixtures/   由上游記錄的 golden corpus，以及逐欄比對測試（僅供測試使用）
skills/
└─ qimen/SKILL.md    供 agent 載入的解讀程序（草稿）
scripts/
├─ gen-corpus.py        執行上游引擎並記錄輸出（手動執行，非 CI 流程）
├─ gen-jieqi-table.py   由 sxtwl 產生節氣時刻表
└─ gen-ke-tables.py     由上游原始碼產生暗干與刻家天盤資料表
```

`core` 不涉及任何 MCP 概念；`mcp` 負責 schema、錯誤映射與 tool 描述。`fixtures` 僅供測試使用，不會於執行期載入。

具快取（memoized）的推導結果，以及 `get_qimen_chart`／`get_qimen_chart_minute`／`get_golden_mirror_chart`／`check_patterns` 等 tool 回傳的完整盤面結果，皆會進行深層凍結（deep freeze），以避免呼叫端修改共享的快取狀態。並非引擎所有回傳物件皆為 immutable——詳見下方「已知限制與重要行為」。

每個具固定回傳形狀的 tool 皆同時宣告 `inputSchema` 與 `outputSchema`，令 client 可直接由 `tools/list` 取得完整契約。輸出 schema 由編譯期（`types-check.ts` 斷言 schema 與 core 型別互相相容）與執行期（測試以真實引擎輸出驗證 schema）雙重把關；core 型別一旦改動而未同步更新 schema，建置即會失敗。

---

## 安裝需求

- Node.js ≥ 22
- pnpm
- 不需要 Python、原生擴充套件、網路連線或 API key

---

## 安裝與建置

```sh
git clone https://github.com/cka4913/qimen-mcp.git
cd qimen-mcp
pnpm install
pnpm build     # → packages/mcp/dist/index.js
pnpm test
```

執行 server：

```sh
node packages/mcp/dist/index.js
# qimen-mcp v0.1.0 listening on stdio
```

無需設定任何環境變數。

---

## MCP client 設定

Server 以 stdio 方式啟動，任何支援 stdio transport 的 MCP client 皆可設定為：

```json
{
  "mcpServers": {
    "qimen": {
      "command": "node",
      "args": ["/absolute/path/to/qimen-mcp/packages/mcp/dist/index.js"]
    }
  }
}
```

Claude Desktop、Claude Code 等個別 client 的詳細設定步驟、skill 安裝方式及疑難排解，見 [docs/HERMES.md](docs/HERMES.md)。

---

## MCP tools 一覽

| Tool | 輸入 | 回傳 |
|---|---|---|
| `resolve_time` | `timezone?` | 目前民用時間——全專案唯一讀取系統時鐘的 tool |
| `get_qimen_chart` | `datetime`, `method` | 時家完整盤面 |
| `get_qimen_chart_minute` | `datetime`, `method` | 刻家完整盤面，連同暗干／飛干 |
| `get_golden_mirror_chart` | `datetime` | 金函玉鏡日家盤面 |
| `get_ju` | `datetime` | 兩派局名，連同置閏法的完整推導 |
| `check_patterns` | `datetime`, `method` | 青龍返首／飛鳥跌穴／玉女守門，各回傳宮位或 `null` |
| `get_closed_sixwu` | `datetime` 或 `xunHead`, `version` | 真人閉六戊法路徑，共七步 |
| `render_chart_text` | `datetime`, `method`, `style?` | 九宮文字盤 |
| `lookup_reference` | `category`, `key?` | 單一名詞的全稱、五行及屬性 |
| `find_chart_times` | `start`, 各項盤面條件 | 搜尋符合條件的時辰（擇時），條件須同宮成立 |

`lookup_reference` 因應 `category` 不同而回傳不同形狀，因此不宣告固定 `outputSchema`；其餘九個 tool 皆有完整 input／output schema。

完整契約見 [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md)；演算法細節見 [docs/RULES.md](docs/RULES.md)。

---

## 使用範例

```jsonc
→ get_qimen_chart { "datetime": "2024-06-15T14:30", "method": "zhirun" }
← {
    "resolved": { "datetime": {…}, "method": "zhirun" },
    "pillars":  { "year": "甲辰", "month": "庚午", "day": "庚戌", "hour": "癸未", "ke": "辛酉" },
    "ju":       "陽遁六局上元",
    "jieqi":    "芒種",
    "zhifuZhishi": {
      "zhifuStem":  ["甲戌", "己"],
      "zhifuStar":  ["柱", "坤"],
      "zhishiDoor": ["驚", "兌"]
    },
    "skyPlate": {…}, "earthPlate": {…},
    "lodgedStem": { "stem": "己", "palace": "離" },   // 中宮天干讀於天禽所在宮

    "doors": {…}, "stars": {…}, "gods": {…},
    "kong":  { "day": "寅卯", "hour": "申酉" },
    "horses": { "tianMa": "戌", "dingMa": "未", "yiMa": "巳" },
    "stages": { "sky": {…}, "earth": {…} }   // 每宮一至兩個階段，見 RULES.md
  }
```

`render_chart_text` 對同一時刻的輸出見 [docs/RULES.md](docs/RULES.md) 及專案內測試；完整欄位定義見 [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md)。

---

## 測試與可信度

- **264 個測試，全數通過**，涵蓋 **69,146 個抽樣時刻**的逐欄比對。
- Golden corpus 由 `scripts/gen-corpus.py` 執行**固定版本**的上游 Python 引擎產生（`f4c6118665253f897889290d8630f9b4cb3a4404`），並將該版本記錄於每份 corpus 檔案；重新產生時若上游版本不符會直接失敗，避免基準悄然漂移。
- 已知刻意偏離之處記錄於 [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md)，並各自有測試釘住。

抽樣涵蓋：1900–2100 全年段均勻抽樣、每個節氣交界前後十分鐘一格密集抽樣、兩個置閏窗口逐日抽樣、每個十分鐘刻邊界抽樣。

---

## 已知限制與重要行為

- **支援範圍為 1900–2100 年**，此為節氣時刻表的涵蓋範圍。
- **排盤 tool 會拒絕不存在的民用日期**（例如 2024-02-30），不會將其靜默正規化為其他日期。此驗證適用於 MCP tool 及主要盤面建構函式；`@cka4913/qimen-core` 部分底層曆法輔助函式（例如 `currentJieqiStart`、`jieqiOnDay`）未附帶相同驗證，直接使用時請自行檢查輸入。
- **不做時區轉換、日光節約或真太陽時校正**。引擎排的是你傳入的鐘錶時間本身。
- **23:00 起計為次日子時**（晚子時慣例），22:59 與 23:01 會得出不同日柱。
- **值符入中宮時，天盤只有八個宮位**——`skyPlate` 缺少 `中` key 屬正常現象（中寄坤），並非資料遺漏。此時中宮天干只出現於 `lodgedStem`（讀於天禽所在宮）。
- **中宮無門**——`doors` 在時家與刻家盤面中不含 `中` key。
- **具快取推導結果與完整盤面結果會進行深層凍結**，避免呼叫端修改共享快取狀態；並非全部 `@cka4913/qimen-core` 匯出函式的回傳值皆為 immutable。
- **`check_patterns` 只涵蓋三個上游有實作的格局**，並非奇門格局全集；其餘吉凶格局需由呼叫端自行由天地盤與門星神組合判斷。
- **月柱與年柱按節氣的精確時刻切換，而非整日**（刻意偏離上游 day-granular 慣例）。節氣當日、節氣時刻之前，月柱仍屬上一個月；立春當日、立春時刻之前，年柱仍屬上一年。目的是令月柱與同盤的節氣欄位自洽；詳見 [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) D9。

---

## 文件索引

| 文件 | 內容 |
|---|---|
| [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md) | 完整 tool 契約——輸入、輸出、錯誤代碼 |
| [docs/RULES.md](docs/RULES.md) | 引擎實際計算內容與計算順序 |
| [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) | 每一項與上游刻意不同之處 |
| [docs/SKILLS.md](docs/SKILLS.md) | 隨附 skill 文件的緣由與維護方式 |
| [docs/HERMES.md](docs/HERMES.md) | Client 設定與疑難排解 |
| [ROADMAP.md](ROADMAP.md) | 各階段進度紀錄 |

---

## 貢獻方式

歡迎透過 [GitHub Issues](https://github.com/cka4913/qimen-mcp/issues) 回報問題或提出功能建議。目前專案未設有正式的 `CONTRIBUTING.md` 或 issue template；提交 pull request 前建議先開 issue 討論方向。修改演算法相關程式碼時，請確保 `pnpm test` 全數通過，並於改動涉及與上游行為不同之處時同步更新 [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md)。

---

## 重要聲明

- 本專案是計算與研究工具，**並非醫療、法律或財務專業意見**。涉及健康、法律、財務等議題的查詢，結果僅供參考，請諮詢相關專業人士。
- [`skills/qimen/SKILL.md`](skills/qimen/SKILL.md) 所載的解讀程序**屬未經流派校訂的草稿**，不同傳承對用神取法與格局判斷或有出入，使用前請自行核實。
- 引擎本身的移植忠實度（parity）與 skill 文件的解讀學理，是兩件獨立的事：前者逐欄驗證，後者未經驗證。

---

## License 與 Attribution

本專案以 [MIT License](LICENSE) 授權。上游 [kentang2017/kinqimen](https://github.com/kentang2017/kinqimen) 的 README 聲明採用 MIT License，但其 repository 未包含完整的 `LICENSE` 文件；詳情與來源標示見 [NOTICE.md](NOTICE.md)。移植過程之細節見 [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md)。

<br>

---

<br>

# qimen-mcp (English)

> A deterministic Qi Men Dun Jia (奇門遁甲) facts engine, exposed as Model Context Protocol (MCP) tools for AI agents.

[![CI](https://github.com/cka4913/qimen-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/cka4913/qimen-mcp/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/cka4913/qimen-mcp/releases)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-%5E1.29-000000)](https://github.com/modelcontextprotocol/typescript-sdk)
[![License: MIT](https://img.shields.io/github/license/cka4913/qimen-mcp)](LICENSE)

> The MCP protocol version is negotiated automatically by `@modelcontextprotocol/sdk` at connect time; this project does not pin a single protocol version. Development and tests currently exercise the `2024-11-05` initialize handshake.

---

## What this is

`qimen-mcp` is a deterministic calculation engine for Qi Men Dun Jia (時家/刻家/金函玉鏡 — hour-based, minute-based, and daily charts), implemented in pure TypeScript and exposed over a stdio MCP server as structured chart data.

Call any chart tool and you get back facts: which stem sits in which palace on both plates, where the Duty Star (值符) and Duty Gate (值使) landed, the arrangement of the nine stars, eight gates and eight gods, the void branches (旬空) and the three horse stars (馬星), and the twelve life stages of every palace (a list, since the four corner palaces cover two branches each). **The engine does not judge fortune or produce narrative interpretation** — that is the calling agent's responsibility. The repository ships [`skills/qimen/SKILL.md`](skills/qimen/SKILL.md) as a reference procedure for agents doing that interpretation, but the 用神-selection and pattern-reading material in that document is an unreviewed draft assembled from common doctrine and should be verified against your own tradition before use.

This project is ported from [kentang2017/kinqimen](https://github.com/kentang2017/kinqimen) (Python, with a Streamlit front end). The upstream repository is untouched; this one extracts the calculation logic, drops the UI and report generator, and replaces the `sxtwl`/`ephem` native extensions with `lunar-javascript`. Faithfulness to upstream is not merely claimed — it is verified field by field; see "Testing and Trust" below.

---

## Features

| System | Description |
|---|---|
| 時家奇門 (Hour chart) | Charted from the double-hour, both 拆補 and 置閏 schools supported |
| 刻家奇門 (Minute chart) | Ten-minute-resolution charting, with 暗干 (hidden stems) and 飛干 (flying stem) |
| 金函玉鏡 (Golden Mirror) | A daily chart requiring only the date, no hour |
| 排局 (Bureau lookup) | Both schools' bureau labels, with the full 置閏 derivation |
| 格局 (Pattern detection) | Fact-checks for three named configurations: 青龍返首, 飛鳥跌穴, 玉女守門 |
| 真人閉六戊法 (Closed Six Wu) | The occult path calculation, in either transmission |
| Text chart | The nine-palace grid rendered as plain text |
| Reference lookup | Names, elements and attributes for gates, stars, gods, stems, branches, palaces and solar terms |
| Chart search (找局) | Find 時辰 whose plates satisfy a set of conditions, for 擇時; conditions must hold in one palace |

---

## Design principles

1. **Deterministic.** Same input, same output, always. The engine never reads the system clock, applies no timezone conversion, and applies no daylight-saving or true-solar-time correction.
2. **Explicit time.** Every time-dependent query requires an explicit `datetime`. `resolve_time` is the only tool in the project that reads the clock, and its result must be passed back into other tools explicitly.
3. **No network dependency.** No external services, no API key, no network calls.
4. **Facts, not readings.** Tools return chart facts, not fortune judgments or narrative. Interpretation belongs to the calling agent, guided procedurally by the accompanying skill document.
5. **Two schools, no thumb on the scale.** 拆補法 and 置閏法 disagree, and neither is objectively "correct". Both are implemented; the engine requires the caller to choose explicitly rather than choosing for them.

---

## Architecture

```
packages/
├─ core/       pure calculation engine — calendar, pillars, bureau, plates, charts. Zero I/O
├─ mcp/        stdio MCP server — 10 tools, zod schemas, error mapping
└─ fixtures/   golden corpus recorded from upstream + the parity test suites (test-only)
skills/
└─ qimen/SKILL.md    interpretation procedure for an agent to load (draft)
scripts/
├─ gen-corpus.py        record upstream's output (run by hand, not part of CI)
├─ gen-jieqi-table.py   generate the solar-term table from sxtwl
└─ gen-ke-tables.py     generate the 暗干 and 刻家天盤 data tables from upstream source
```

`core` has no knowledge of MCP; `mcp` adds schemas, error mapping and tool descriptions. `fixtures` is test-only and never loaded at runtime.

Memoized derivations, and the complete chart results returned by `get_qimen_chart`, `get_qimen_chart_minute`, `get_golden_mirror_chart` and `check_patterns`, are deep-frozen to prevent a caller from mutating shared cached state. Not every object `@cka4913/qimen-core` exports is immutable — see "Known Limitations and Behaviors" below.

Every tool with a fixed result shape declares both an `inputSchema` and an `outputSchema`, so a client can read the full contract from `tools/list`. Output schemas are guarded twice: at compile time (`types-check.ts` asserts each schema is mutually assignable with its corresponding core type) and at runtime (tests parse real engine output through the schemas). Renaming a field in `core` without updating the schema fails the build.

---

## Requirements

- Node.js ≥ 22
- pnpm
- No Python, no native extensions, no network access, no API keys

---

## Install and Build

```sh
git clone https://github.com/cka4913/qimen-mcp.git
cd qimen-mcp
pnpm install
pnpm build     # → packages/mcp/dist/index.js
pnpm test
```

Run the server:

```sh
node packages/mcp/dist/index.js
# qimen-mcp v0.1.0 listening on stdio
```

No environment variables required.

---

## MCP Client Configuration

The server runs over stdio and can be configured for any MCP client that spawns stdio servers:

```json
{
  "mcpServers": {
    "qimen": {
      "command": "node",
      "args": ["/absolute/path/to/qimen-mcp/packages/mcp/dist/index.js"]
    }
  }
}
```

Detailed setup for Claude Desktop, Claude Code and similar clients, plus skill installation and troubleshooting, is in [docs/HERMES.md](docs/HERMES.md).

---

## MCP Tools

| Tool | Input | Returns |
|---|---|---|
| `resolve_time` | `timezone?` | The current civil datetime — the only tool that reads a clock |
| `get_qimen_chart` | `datetime`, `method` | 時家 full chart |
| `get_qimen_chart_minute` | `datetime`, `method` | 刻家 full chart, plus 暗干/飛干 |
| `get_golden_mirror_chart` | `datetime` | 金函玉鏡 day chart |
| `get_ju` | `datetime` | Both bureau labels, plus the 置閏 workings |
| `check_patterns` | `datetime`, `method` | 青龍返首/飛鳥跌穴/玉女守門, each a palace or `null` |
| `get_closed_sixwu` | `datetime` or `xunHead`, `version` | 閉六戊 path, seven steps |
| `render_chart_text` | `datetime`, `method`, `style?` | The nine-palace square as text |
| `lookup_reference` | `category`, `key?` | Name, element and attributes of one term |
| `find_chart_times` | `start`, plate conditions | Search for 時辰 matching the conditions, all in one palace |

`lookup_reference`'s result shape varies by `category`, so it declares no fixed `outputSchema`; the other nine tools each declare a complete input and output schema.

Full contract: [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md). Algorithm details: [docs/RULES.md](docs/RULES.md).

---

## Example

```jsonc
→ get_qimen_chart { "datetime": "2024-06-15T14:30", "method": "zhirun" }
← {
    "resolved": { "datetime": {…}, "method": "zhirun" },
    "pillars":  { "year": "甲辰", "month": "庚午", "day": "庚戌", "hour": "癸未", "ke": "辛酉" },
    "ju":       "陽遁六局上元",
    "jieqi":    "芒種",
    "zhifuZhishi": {
      "zhifuStem":  ["甲戌", "己"],
      "zhifuStar":  ["柱", "坤"],
      "zhishiDoor": ["驚", "兌"]
    },
    "skyPlate": {…}, "earthPlate": {…},
    "lodgedStem": { "stem": "己", "palace": "離" },   // 中宮天干讀於天禽所在宮

    "doors": {…}, "stars": {…}, "gods": {…},
    "kong":  { "day": "寅卯", "hour": "申酉" },
    "horses": { "tianMa": "戌", "dingMa": "未", "yiMa": "巳" },
    "stages": { "sky": {…}, "earth": {…} }   // 每宮一至兩個階段，見 RULES.md
  }
```

For `render_chart_text` output on the same moment and the complete field reference, see [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md) and [docs/RULES.md](docs/RULES.md).

---

## Testing and Trust

- **264 tests, all passing**, exercising **69,146 sampled moments** compared field by field against upstream.
- The golden corpus is produced by `scripts/gen-corpus.py` running a **pinned upstream commit** (`f4c6118665253f897889290d8630f9b4cb3a4404`); that revision is recorded in every corpus file, and regeneration refuses to run against a different upstream commit — so the baseline cannot silently drift.
- Deliberate deviations from upstream are documented in [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md), each pinned by its own test.

Sampling covers: uniform sampling across the full 1900–2100 span, dense ten-minute-resolution sampling around every solar-term boundary, day-by-day sampling of both 置閏 windows, and sampling at every ten-minute 刻 boundary.

---

## Known Limitations and Behaviors

- **Supported range is 1900–2100**, the span of the solar-term table.
- **Chart tools reject impossible civil dates** (e.g. 2024-02-30) instead of silently normalizing them. This validation applies to the MCP tools and the main chart-building functions; some lower-level `@cka4913/qimen-core` calendar helpers (e.g. `currentJieqiStart`, `jieqiOnDay`) do not carry the same validation — check inputs yourself if calling them directly.
- **No timezone conversion, no daylight saving, no true-solar-time correction.** The engine charts exactly the wall-clock time you give it.
- **23:00 belongs to the next day** (晚子時 convention); 22:59 and 23:01 produce different day pillars.
- **The sky plate has eight palaces, not nine, when the Duty Star sits in the center palace** — `skyPlate` missing a `中` key is expected behavior (中寄坤), not a data gap. In that case 中宮's stem appears only in `lodgedStem`, read at whichever palace 天禽 occupies.
- **The center palace has no gate** — `doors` never carries a `中` key in the hour and minute charts.
- **Memoized derivations and complete chart results are deep-frozen** to prevent a caller from mutating shared cached state; not every object exported by `@cka4913/qimen-core` is immutable.
- **`check_patterns` covers only the three patterns upstream implements**, not the full canon of Qi Men patterns. Others must be read by the caller from the plates, gates, stars and gods directly.
- **Month and year pillars switch at the solar term's exact minute, not for the whole day** (a deliberate departure from upstream's day-granular convention). On a 節 day before the term's minute the month pillar still belongs to the previous month; on 立春 day before the 立春 minute the year pillar still belongs to the previous year. This keeps the month pillar consistent with the 節氣 field of the same chart; see [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) D9.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md) | The full tool contract — inputs, outputs, error codes |
| [docs/RULES.md](docs/RULES.md) | What the engine computes, in order |
| [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) | Every deliberate departure from upstream |
| [docs/SKILLS.md](docs/SKILLS.md) | Why a skill ships here, and how to maintain it |
| [docs/HERMES.md](docs/HERMES.md) | Client setup and troubleshooting |
| [ROADMAP.md](ROADMAP.md) | Phase-by-phase progress |

---

## Contributing

Issues and feature requests are welcome via [GitHub Issues](https://github.com/cka4913/qimen-mcp/issues). There is no formal `CONTRIBUTING.md` or issue template yet; open an issue to discuss direction before sending a pull request. When changing algorithm code, make sure `pnpm test` passes, and update [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) if the change introduces or resolves a divergence from upstream.

---

## Important Notices

- This is a calculation and research tool, **not medical, legal or financial advice**. Queries touching health, legal or financial matters are for reference only — consult a qualified professional.
- The interpretation procedure in [`skills/qimen/SKILL.md`](skills/qimen/SKILL.md) **is an unreviewed draft**. Different schools of Qi Men Dun Jia disagree on 用神 selection and pattern reading; verify against your own tradition before relying on it.
- The engine's parity with upstream and the skill document's doctrine are two separate claims: the former is verified field by field; the latter is not.

---

## License and Attribution

This project is licensed under the [MIT License](LICENSE). The README of upstream [kentang2017/kinqimen](https://github.com/kentang2017/kinqimen) states that it is MIT-licensed, but that repository does not contain the complete `LICENSE` text; see [NOTICE.md](NOTICE.md) for attribution and details. Porting details are in [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md).
