# kinqimen-mcp

> 奇門遁甲 as an MCP **facts engine** — 時家 / 刻家 / 金函玉鏡, computed in pure TypeScript and exposed as deterministic MCP tools for AI agents.
>
> 奇門遁甲嘅 MCP **事實引擎**——時家、刻家、金函玉鏡三套盤，純 TypeScript 運算，以 deterministic MCP tool 形式俾 AI agent 用。

---

## What this is · 咩嚟

**EN** — A stdio MCP server plus a pure TypeScript core. Hand it a moment and it hands back a chart: which stem sits in which palace on both plates, where the 值符 and 值使 landed, the nine stars, eight gates and eight gods, the 旬空 and 馬星, the twelve life stages of every palace.

It does **not** interpret. No tool returns 吉, 凶, advice or a narrative — that is the calling agent's job, and [`skills/kinqimen/SKILL.md`](skills/kinqimen/SKILL.md) ships with the repo to help it do that job properly: find the 用神, read outward in a fixed order, trace every claim back to a field.

**中** — 一個 stdio MCP server 加一個純 TypeScript core。俾佢一個時間，佢回一張盤：天地兩盤邊個宮擺邊個天干、值符值使落邊、九星八門八神、旬空馬星、每宮嘅十二長生。

佢**唔會解讀**。冇任何 tool 回吉凶、建議或者敘述——嗰個係 calling agent 嘅工作，而 repo 附咗 [`skills/kinqimen/SKILL.md`](skills/kinqimen/SKILL.md) 幫佢做好呢份工：搵用神、照次序讀落去、每句判語都指得出出處。

---

## Provenance · 出處

**EN** — Ported from [kentang2017/kinqimen](https://github.com/kentang2017/kinqimen), a Python library with a Streamlit front end. That repo is untouched; this one extracts the calculation logic, drops the UI and the LLM report generator, replaces the `sxtwl`/`ephem` C extensions with a pure-JS calendar layer, and puts the whole thing behind a test suite.

Faithfulness is enforced, not assumed. `scripts/gen-corpus.py` runs the upstream Python engine over **69,146 sampled moments** — the whole 1900–2100 span, every solar-term boundary at ten-minute resolution, both 置閏 windows day by day, every ten-minute 刻 boundary — and records its output. `packages/fixtures/tests/` then compares this engine against that recording field by field. Where this engine deliberately differs, [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) records the decision and the upstream line it replaces, and a test pins it.

**中** — 由 [kentang2017/kinqimen](https://github.com/kentang2017/kinqimen) 移植——嗰個係 Python library 加 Streamlit 介面。原 repo 冇郁過；呢個抽走運算邏輯、丟低 UI 同 LLM 報告生成、將 `sxtwl`／`ephem` 兩個 C extension 換成純 JS 曆法層，再擺埋一套測試喺後面。

忠實度係驗出嚟唔係靠講：`scripts/gen-corpus.py` 攞上游 Python 引擎跑 **69,146 個取樣時刻**——1900–2100 全段、每個節氣交界十分鐘一格、兩個置閏窗口逐日、每個十分鐘刻邊界——錄低佢嘅輸出，再由 `packages/fixtures/tests/` 逐欄比對。有意唔同嘅地方，[docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) 記低咗每個決定同佢取代嘅上游行號，而且每條都有測試釘住。

---

## Design philosophy · 設計哲學

1. **Facts, not readings.** Tools return what the plates say. Judgement belongs to the agent, and every sentence it writes should trace back to a tool result.
2. **The engine never calls `now()`.** Every time-dependent query takes an explicit `datetime`. The *only* tool that reads the clock is `resolve_time`, and its answer must be passed back in explicitly. That is what makes a response reproducible, cacheable and auditable.
3. **Upstream's output is the specification.** Where upstream does something odd but consistent, this port does the same odd thing. It departs only where upstream is demonstrably broken, and then loudly — see [PORTING-NOTES.md](docs/PORTING-NOTES.md).
4. **Honest about gaps.** 鶴神 is mostly `null` because upstream's table is incomplete, and says so. A table miss is an error with a code, never a plausible default.
5. **Two schools, no thumb on the scale.** 拆補 and 置閏 disagree; the engine implements both and refuses to choose.

---

## Architecture · 架構

```
packages/
├─ core/       pure engine — calendar, pillars, 排局, plates, charts. Zero I/O
├─ mcp/        stdio MCP server — 9 tools, zod schemas, error mapping
└─ fixtures/   golden corpus recorded from upstream + the parity suites (test-only)
skills/
└─ kinqimen/SKILL.md    the interpretation doctrine an agent loads
scripts/
├─ gen-corpus.py        record upstream's output (run by hand, not in CI)
├─ gen-jieqi-table.py   emit the solar-term table from sxtwl
└─ gen-ke-tables.py     emit the 暗干 and 刻家天盤 tables from upstream source
```

`core` knows nothing about MCP; `mcp` adds schemas, error mapping and tool descriptions. `fixtures` is test-only and never loaded at runtime.

Every tool that returns a fixed shape declares both an `inputSchema` and an `outputSchema`, so a client can read the full result shape from `tools/list`. The output schemas are kept honest two ways: `types-check.ts` asserts at compile time that each is mutually assignable with the core type it describes, and a test parses real engine output through them. Rename a field in `core` and the build fails.

---

## Install · 安裝

Requires Node ≥ 22. No Python, no native extensions, no network, no API keys.

```sh
pnpm install
pnpm build     # → packages/mcp/dist/index.js
pnpm test      # 55 tests over 69,146 corpus cases, ~6s
```

---

## Run · 運行

```sh
node packages/mcp/dist/index.js
# kinqimen-mcp v0.1.0 listening on stdio
```

No environment variables. See [docs/HERMES.md](docs/HERMES.md) for Claude Desktop / Claude Code / Hermes configuration.

---

## Tools · 工具

| Tool | Input | Returns |
|---|---|---|
| `resolve_time` | `timezone?` | The current civil datetime — the only tool that reads a clock |
| `get_qimen_chart` | `datetime`, `method` | 時家 full chart |
| `get_qimen_chart_minute` | `datetime`, `method` | 刻家 full chart, plus 暗干／飛干 |
| `get_golden_mirror_chart` | `datetime` | 金函玉鏡 day chart |
| `get_ju` | `datetime` | All three bureau labels plus the 置閏 workings |
| `check_patterns` | `datetime`, `method` | 青龍返首／飛鳥跌穴／玉女守門, each a palace or `null` |
| `get_closed_sixwu` | `datetime` or `xunHead`, `version` | 閉六戊 path, seven steps |
| `render_chart_text` | `datetime`, `method`, `style?` | The nine-palace square as text |
| `lookup_reference` | `category`, `key?` | Name, 五行 and attributes of one term |

Full contract in [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md); the algorithm itself in [docs/RULES.md](docs/RULES.md).

---

## Example · 例子

```jsonc
→ get_qimen_chart { "datetime": "2024-06-15T14:30", "method": "zhirun" }
← {
    "resolved": { "datetime": {…}, "method": "zhirun" },
    "pillars":  { "year": "甲辰", "month": "庚午", "day": "庚戌", "hour": "癸未", "ke": "辛酉" },
    "ju":       "陽遁六局上元",
    "jieqi":    "芒種",
    "zhifuZhishi": {
      "zhifuStem":  ["甲戌", "己"],
      "zhifuStar":  ["柱", "坤"],     // 天柱 in 坤宮
      "zhishiDoor": ["驚", "兌"]      // 驚門 in 兌宮
    },
    "skyPlate":   { "坤": "己", "離": "辛", … },
    "earthPlate": { "坤": "癸", "離": "辛", …, "中": "乙" },
    "doors": {…}, "stars": {…}, "gods": {…},
    "kong":  { "day": "寅卯", "hour": "申酉" },
    "horses": { "tianMa": "戌", "dingMa": "未", "yiMa": "巳" },
    "stages": { "sky": {…}, "earth": {…} }
  }
```

`render_chart_text` on the same moment:

```
時家奇門｜置閏
甲辰年 庚午月 庚戌日 癸未時
陽遁六局上元｜節氣：芒種｜局日：乙庚日
值符：天柱 在 坤宮｜值使：驚門 在 兌宮

+----------+----------+----------+
| 地　杜門 | 天　景門 | 符　死門 |
| 英　天辛 | 禽　天癸 | 柱　天己 |
| 巽　地丙 | 離　地辛 | 坤　地癸 |
+----------+----------+----------+
| 雀　傷門 | 　　　　 | 蛇　驚門 |
| 輔　天丙 | 　　天乙 | 心　天戊 |
| 震　地丁 | 中　地乙 | 兌　地己 |
+----------+----------+----------+
| 勾　生門 | 合　休門 | 陰　開門 |
| 沖　天丁 | 任　天庚 | 蓬　天壬 |
| 艮　地庚 | 坎　地壬 | 乾　地戊 |
+----------+----------+----------+
```

---

## Gotchas · 要留意

- **23:00 belongs to the next day** (晚子時). 22:59 and 23:01 give different day pillars.
- **The sky plate has eight palaces when the 值符 is in 中宮** — 中 is absent, by 中寄坤. Code that assumes nine keys will break.
- **中宮 has no gate.** `doors` has no `中` key in the 時家 and 刻家 charts.
- **No timezone, no 真太陽時.** The engine charts the wall clock you hand it.
- **Supported range is 1900–2100**, the span of the solar-term table.
- **Charts from 2079-06-06 onward differ from upstream deliberately** — a float64 limit in upstream's `ephem` misreads the hour there. [PORTING-NOTES.md](docs/PORTING-NOTES.md) D1.

---

## Documentation · 文件

| Doc | What |
|---|---|
| [docs/AI-AGENT-INTEGRATION.md](docs/AI-AGENT-INTEGRATION.md) | The tool contract — inputs, outputs, error codes |
| [docs/RULES.md](docs/RULES.md) | What the engine computes, in order |
| [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) | Every deliberate departure from upstream |
| [docs/SKILLS.md](docs/SKILLS.md) | Why a skill ships here, and how to change it |
| [docs/HERMES.md](docs/HERMES.md) | Client setup and troubleshooting |
| [ROADMAP.md](ROADMAP.md) | Phase-by-phase progress |

---

## Licence · 授權

MIT, matching upstream.
