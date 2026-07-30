# The skill · 解讀 skill

> Why this repository ships a skill at all, what is in it, and how to change it. The skill itself is [`skills/qimen/SKILL.md`](../skills/qimen/SKILL.md).

---

## Why a skill ships with a facts engine

The engine deliberately stops short of interpretation. That leaves a gap: an agent handed nine palaces of stems, gates, stars and gods will produce *something*, and without guidance that something tends to be a confident-sounding paraphrase of the field names.

奇門 has an actual procedure — find the 用神, then read outward in a fixed order — and an agent that follows it produces a reading that can be checked. An agent that does not produces astrology-flavoured noise. The skill is that procedure, written down.

It is also where the discipline lives: every claim traces to a tool result, no inventing symbols that are not on the plate, no choosing the school on the user's behalf, no medical or legal verdicts.

---

## What is in it

1. **Seven hard rules** — traceability, no invented plate entries, explicit time, a disclosed default school (拆補, with 置閏 offered rather than silently withheld), no verdicts, 法術奇門 not volunteered, and 年命宮 kept optional and non-authoritative.
2. **A call flow** — `resolve_time` with auto-detected timezone confirmed back to the user, an optional birth-year prompt, which chart tool for which kind of question, and when to reach for 刻家 or 金函玉鏡 instead of 時家.
3. **用神 selection** — the four constants (值符, 值使, 日干, 時干), a table from question type to symbol, and an optional supplementary technique (年命宮) for questions about the person rather than the event.
4. **A reading order** — seven core steps from 值符值使 outward to 格局, plus an eighth optional step for 年命宮 when a birth year was given, so the reading is reproducible rather than impressionistic.
5. **格局** — the three the engine detects, and an explicit note that they are not the whole canon.
6. **Output shape** — what a complete reading contains.
7. **Traps** — the shapes that look like bugs and are not (missing 中宮, 23:00 rollover, `craneGod`, no 真太陽時, no MCP tool for 年命宮).

---

## Provenance and status

The 用神 and 格局 material is assembled from the common doctrine of 《煙波釣叟歌》 and 《奇門遁甲統宗》, cross-read against the four personas in the upstream repo's `data/system_prompts.json` (奇門遁甲大師 / 軍師謀略家 / 奇門占卜師 / 法術奇門大師).

**年命宮 is a step further out than the rest.** It is not part of classical 時家奇門 at all — upstream `kinqimen` has no birth-year or gender parameter anywhere in its source, confirmed by direct search. The technique (birth-year branch → one of the eight palaces, via the same branch-to-palace correspondence `sixwu.ts` already uses for 閉六戊) belongs to eclectic practice for reading a *person* rather than an *event*, and is documented as an optional supplementary lens, never as a required input or a core method.

**It is a draft and says so at the top.** Schools disagree, most sharply on 求財, 官非 and 疾病. Anyone using this seriously should reconcile the tables against their own transmission before trusting them. The engine's output is verified against upstream byte for byte; the skill's doctrine is not verifiable in that sense and should not be presented as if it were.

---

## Changing it

`packages/fixtures/tests/skill.spec.ts` holds the skill to reality:

- every tool name it mentions must exist,
- every tool must be mentioned at least once, so none is silently unreachable,
- every chart field path it tells an agent to read must resolve on a real chart,
- and the factual claims it makes about shapes — 中宮 has no gate, 23:00 rolls the day over, 刻家's `kong` is the hour/刻 pair — are each asserted directly.

That suite caught two real gaps while the skill was being written: it never told the agent about `get_ju` or `get_closed_sixwu`, so an agent following it would never have called either.

Doctrine is not testable and is not tested. Structure is, and is.
