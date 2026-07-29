# Tool contract · 工具契約

> What each tool takes, what it returns, and what it refuses to do. For setup see [HERMES.md](HERMES.md); for how to *read* a chart see [SKILLS.md](SKILLS.md) and [`skills/kinqimen/SKILL.md`](../skills/kinqimen/SKILL.md).

---

## The contract in one paragraph

Every tool is a pure function of its arguments. Same input, same output, forever — no clock, no timezone, no session, no network, no API key. The one exception is `resolve_time`, which exists precisely so that the exception is explicit: it reads the clock, hands you a string, and every other tool makes you pass that string back in. Results are deep-frozen; copy before modifying. Business failures come back as `{ error: { code, message } }` with `isError: true`; malformed arguments come back as a `-32602` validation error whose body is a plain sentence rather than JSON. Branch on `code`, never on message text.

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

Every tool except `lookup_reference` declares an `outputSchema`, so a client can read the full result shape from `tools/list` rather than inferring it. `lookup_reference` is exempt because its payload differs per category.

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

**The sky plate sometimes has eight palaces, not nine.** When the 值符 sits in 中宮, 中 is absent from `skyPlate`. That is 中寄坤, not a missing field. Any code that assumes nine keys will break on roughly a ninth of all charts.

**中宮 has no gate.** `doors` never has a `中` key in the 時家 and 刻家 charts. In the 金函玉鏡 chart it does, carrying an empty string, because upstream emits it that way.

**`kong` means different things in the two charts.** 時家: `{ day, hour }`. 刻家: `{ hour, ke }`. Upstream labels both pairs 日空/時空; this port names them for what they actually are.

**`craneGod` is usually `null`.** See [PORTING-NOTES.md](PORTING-NOTES.md) D6 — the upstream table is incomplete and returns repeated characters rather than directions. Do not read it as a direction.

**`resolved` echoes the inputs.** Every chart carries back the datetime and method it was built from, so a cached result is self-describing. The datetime it echoes is exactly the one you sent — an impossible date is rejected rather than silently normalised.

**Results are frozen.** The engine memoises its derivations and shares them between callers, so everything it returns is deep-frozen. Mutating a result throws a `TypeError`; copy it first if you need to change it. (Over MCP this is invisible — you receive JSON — but it matters when using `@kinqimen/core` directly.)

---

## Errors

Two channels, and they look different on the wire:

- **Schema violations** — a missing argument, a bad `datetime` format, an unknown enum value. The SDK rejects these before the handler runs and returns `isError: true` with a plain sentence beginning `MCP error -32602`. **This body is not JSON.** Parsing it will throw.
- **Business failures** — the arguments were well-formed but the engine cannot serve them. `isError: true` with a JSON body: `{ "error": { "code", "message", "details" } }`.

| Code | Meaning |
|---|---|
| `DATETIME_INVALID` | A field is out of range, or the date does not exist (e.g. 2024-02-30) |
| `DATETIME_OUT_OF_RANGE` | Year outside 1900–2100 |
| `ARGUMENT_REQUIRED` | A one-of requirement the schema cannot express — `get_closed_sixwu` needs `datetime` or `xunHead` |
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
