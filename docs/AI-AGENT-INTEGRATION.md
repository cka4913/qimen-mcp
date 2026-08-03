# Tool contract · 工具契約

> What each tool takes, what it returns, and what it refuses to do. For setup see [HERMES.md](HERMES.md); for how to *read* a chart see [SKILLS.md](SKILLS.md) and [`skills/qimen/SKILL.md`](../skills/qimen/SKILL.md).

---

## The contract in one paragraph

Every tool is a pure function of its arguments. Same input, same output, forever — no clock, no timezone, no session, no network, no API key. The one exception is `resolve_time`, which exists precisely so that the exception is explicit: it reads the clock, hands you a string, and every other tool makes you pass that string back in. Business failures come back as `{ error: { code, message } }` with `isError: true`; malformed arguments come back as a `-32602` validation error whose body is a plain sentence rather than JSON. Branch on `code`, never on message text.

---

## Tools

| Tool | Input | Returns |
|---|---|---|
| `resolve_time` | `timezone?` | The current civil datetime, formatted for the other tools |
| `get_qimen_chart` | `datetime`, `method` | 時家 full chart |
| `get_qimen_chart_minute` | `datetime`, `method` | 刻家 full chart, plus 暗干/飛干 |
| `get_golden_mirror_chart` | `datetime` | 金函玉鏡 day chart |
| `get_ju` | `datetime` | All three bureau labels plus the 置閏 workings |
| `check_patterns` | `datetime`, `method` | 青龍返首 / 飛鳥跌穴 / 玉女守門, each a palace or `null` |
| `get_closed_sixwu` | `datetime` or `xunHead`, `version` | 閉六戊 path: seven steps, branch and palace |
| `render_chart_text` | `datetime`, `method`, `style?` | The nine-palace square as text |
| `lookup_reference` | `category`, `key?` | Name, element and attributes of one term |
| `find_chart_times` | `start`, plate conditions | 時辰 whose plates satisfy the conditions, all in one palace |

Every tool except `lookup_reference` declares an `outputSchema`, so a client can read the full result shape from `tools/list` rather than inferring it. `lookup_reference` is exempt because its payload differs per category.

---

## `find_chart_times` — the one tool that searches

Everything else answers "what is the chart for this moment". This one answers "which moments have a chart like this", which is what 擇時 actually needs. Three things about it are easy to get wrong.

**Conditions are per-palace, not per-chart.** `doors: ["生"], skyStems: ["丙"]` finds palaces where 生門 and 丙 sit *together*. It does not find charts that contain both somewhere. Each hit names the palace it matched in. This was established empirically against a separate commercial implementation; the protocol and data are in `test-case/FINDINGS.md`.

**Most single conditions are not selective.** Every chart carries all eight gates, all eight gods, all eight stars and eight or nine sky stems. So `doors: ["生"]` with no palace restriction matches *every* 時辰 — 100% of them. Even 格局 is common: 青龍返首 occurs in roughly 18% of all 時辰. Useful density comes from combining conditions or naming a palace.

**There is no total count.** The scan stops the moment it has `limit` matches, so it does not know how many more exist. Reporting a number it never counted would be worse than reporting none. Use `scannedThrough` as the next `start` to continue, and read `limitReached` / `budgetExhausted` to tell "there are probably more" from "I gave up looking".

`maxDays` bounds the scan so an unsatisfiable query terminates. Asking for both 青龍返首 and 飛鳥跌穴 in one palace is unsatisfiable by construction — one is 戊 over 丙, the other 丙 over 戊 — and will simply burn the budget and return nothing.

---

## `datetime` — the one input that matters

A **civil** datetime: the wall clock where the question is being asked, as `YYYY-MM-DDTHH:mm`.

The engine applies **no timezone conversion, no DST rule, and no 真太陽時 correction**. It charts the moment you hand it. If the querent is far from their zone's central meridian, that is a conversation to have with them — the engine will not have it for you.

Supported range is **1900–2100**, the span of the solar-term table. Outside it: `DATETIME_OUT_OF_RANGE`.

**23:00 belongs to the next day.** 22:59 and 23:01 on the same date produce different day pillars, because 23:00 opens the following day's 子時 (晚子時). This is doctrine, not an off-by-one.

---

## `method` — 拆補 or 置閏

Two schools, both implemented, and they genuinely disagree:

- **`chaibu` 拆補法** — the 元 comes from the day pillar, the bureau from the solar term. Total, no special cases.
- **`zhirun` 置閏法** — the bureau depends on how far the day sits from the solar term, resolving 超神 / 正授 / 接氣 / 閏奇.

Neither is "correct". The engine will not choose for you and neither should an agent: ask the user, or present both. `get_ju` returns both at once when you want to show the difference.

---

## Result shapes worth knowing before you parse

**Palaces are trigrams.** `坎坤震巽中乾兌艮離` are the keys of every plate. They are identities, not display strings.

**The sky plate sometimes has eight palaces, not nine.** When the 值符 sits in 中宮, 中 is absent from `skyPlate` — about one chart in five. That is 中寄坤, not a missing field. Any code that assumes nine keys will break.

**Looking for a stem you cannot find? Check `lodgedStem`.** 中宮 has no place in the rotation, so its stem is read at whichever palace 天禽 occupies. `lodgedStem: { stem, palace }` says which stem and where, on every chart. When the 值符 is in 中宮 this is the *only* place that stem appears, which is what makes it worth checking rather than assuming a bug. It is kept out of `skyPlate` because it is not that palace's own stem.

**中宮 has no gate.** `doors` never has a `中` key in the 時家 and 刻家 charts. In the 金函玉鏡 chart it does, carrying an empty string, because upstream emits it that way.

**`kong` means different things in the two charts.** 時家: `{ day, hour }`. 刻家: `{ hour, ke }`. Upstream labels both pairs 日空/時空; this port names them for what they actually are.

**`craneGod` is usually `null`.** See [PORTING-NOTES.md](PORTING-NOTES.md) D6 — the upstream table is incomplete and returns repeated characters rather than directions. Do not read it as a direction.

**`resolved` echoes the inputs.** Every chart carries back the datetime and method it was built from, so a cached result is self-describing. The datetime it echoes is exactly the one you sent: chart tools reject an impossible civil date (e.g. 2024-02-30) rather than silently normalising it into some other day.

**Memoized and assembled results are frozen.** The engine memoises its internal derivations and shares them between callers, so a mutation by one caller would otherwise poison another's chart. To close that off, every memoized function's output is deep-frozen, and so are the complete results of `get_qimen_chart`, `get_qimen_chart_minute`, `get_golden_mirror_chart` and `check_patterns`. Mutating one of these throws a `TypeError`; copy it first if you need to change it. This is not a blanket guarantee across every export of `@cka4913/qimen-core` — a handful of small, non-memoized helpers (e.g. `closedSixwuForXun`, `lookupReference`) build a fresh object per call and return it unfrozen, which is safe precisely because nothing else shares that object. Over MCP none of this is visible either way — you receive JSON, not a live reference — so it only matters if you import `@cka4913/qimen-core` directly.

---

## Errors

Two channels, and they look different on the wire:

- **Schema violations** — a missing argument, a bad `datetime` format, an unknown enum value. The SDK rejects these before the handler runs and returns `isError: true` with a plain sentence beginning `MCP error -32602`. **This body is not JSON.** Parsing it will throw.
- **Business failures** — the arguments were well-formed but the engine cannot serve them. `isError: true` with a JSON body: `{ "error": { "code", "message", "details" } }`.

| Code | Meaning |
|---|---|
| `DATETIME_INVALID` | A field is out of range, or the date does not exist (e.g. 2024-02-30) |
| `DATETIME_OUT_OF_RANGE` | Year outside 1900–2100 |
| `ARGUMENT_REQUIRED` | A requirement the schema cannot express — `get_closed_sixwu` needs `datetime` or `xunHead`; `find_chart_times` rejects an `end` on the wrong side of `start`, and a 中宮-only search for a 門/星/神 that 中宮 never carries |
| `TIMEZONE_INVALID` | `resolve_time` was handed an unknown IANA zone |
| `UNKNOWN_REFERENCE_KEY` | `lookup_reference` was handed a key that category does not have |

The first four are reachable by a normal caller, and `server.spec.ts` reaches each one through the real protocol. The three below are guards — the data they check is complete (`data.spec.ts` asserts so), so seeing one means a table regressed. Please report it with the input:

| Code | Guards |
|---|---|
| `JIEQI_NOT_FOUND` | No solar term within the search window |
| `ANGAN_NOT_FOUND` | No 暗干 row for this 局+刻柱 — the table covers all 360 |
| `TABLE_LOOKUP_FAILED` | Any other internal table miss |

---

## What the tools will not do

- **No verdicts.** No tool returns 吉, 凶, advice, or a narrative. `check_patterns` reports that 戊 landed on 丙; it does not report that this is good news.
- **No 用神 selection.** The engine will not decide which symbol represents the question.
- **No clock reading.** Except `resolve_time`, and even that only hands you a string to pass on.
- **No guessing.** A table miss is an error with a code, never a plausible-looking default.
