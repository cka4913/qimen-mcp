# Roadmap

Phase-by-phase status. Each phase was gated on its parity suite going green before the next began, so "done" here means "verified against upstream", not "written".

---

## Done

### P0 — Scaffold
pnpm workspace, three packages, `tsc --build` project references, vitest, CI. Mirrors the layout of `zwds-mcp` and `phone-shenshu-mcp`.

### P1 — Calendar and pillars ✅ 29,267 cases
`calendar.ts`, `ganzhi.ts`. `lunar-javascript` replaces `sxtwl`; the ganzhi variants were matched empirically. Solar-term moments moved into a generated table when the two ephemerides were found to disagree by up to a minute on a fifth of all terms.

Found and pinned here: upstream's `ephem` hour bug from 2079-06-06 (D1), and that upstream truncates rather than rounds the term's seconds.

### P2 — 排局 ✅ 26,769 cases
`ju.ts`. Both schools plus every intermediate the 置閏 ladder reads. Passed on the first run.

### P3 — 時家 full chart ✅ 4,112 charts × 2 schools
`plate.ts`, `zhifu.ts`, `stars-doors-gods.ts`, `kong-horse.ts`, `changsheng.ts`, `chart.ts`. Every field compared. Two upstream subtleties surfaced: the unreachable branches in `pan_sky` (D4), and the 長生 collision order (D5).

Memoisation was added here — a chart derives its bureau eight times over, and each derivation was walking the solar-term table again.

### P4 — 刻家 ✅ 774 charts × 2 schools
`ke.ts`, plus two generated data modules: the 360-row 暗干 table and the 360-key 刻家天盤 override ladder, both extracted mechanically from upstream source rather than retyped (D7).

### P5 — 金函玉鏡, 格局, 閉六戊 ✅ 4,112 + 4,112 cases
`golden-mirror.ts`, `patterns.ts`, `sixwu.ts`. 鶴神 reproduced broken and documented (D6). 閉六戊 has no upstream corpus — it lives in the Streamlit UI — so it is covered by unit tests against the rule instead.

### P6 — MCP layer ✅
Nine tools, zod input and output schemas, compile-time drift guard, stdio smoke tests against the real compiled binary.

### P7 — Text view, skill, docs ✅
`render-text.ts`, `skills/qimen/SKILL.md`, five docs. The skill is held to reality by `skill.spec.ts`, which caught two tools the skill had failed to mention.

### P8 — Review follow-up ✅
An external read-only review found eight issues; all eight are fixed and each has a test.

Two mattered. Impossible dates (`2024-02-30`) were accepted, normalised to another day by the underlying calendar, and charted — while `resolved` still echoed the date nobody asked about. And the memo caches handed out shared mutable objects, so one caller mutating a plate changed every later chart for the same moment. Both broke the determinism the whole project is built on. Chart-tool inputs are now validated against the real month length; every memoized derivation and every assembled chart result is deep-frozen.

The rest: a `glossary` argument that was declared but never read (removed — `lookup_reference` already answers that question), two argument errors reported as `INTERNAL_ERROR`, a documented error code with no throw path, a corpus that recorded no upstream revision, and a missing `LICENSE`. `server.spec.ts` and `data.spec.ts` were added to close the gap the review identified: negative paths and table completeness, not just parity.

### P9 — Documentation pass ✅
README rewritten as a full Traditional Chinese section followed by a full English section (no interleaving), with badges and a public-facing structure: features, design principles, architecture, install, client setup, tool table, example, testing and trust, known limitations, documentation index, contributing, notices, license. `docs/HERMES.md` rewritten the same way; its client-facing 中文 prose was previously Cantonese-toned and is now Traditional Chinese book language.

Two claims that had quietly grown broader than the code were narrowed in README and `docs/AI-AGENT-INTEGRATION.md`: "results are deep-frozen" only holds for memoized derivations and the four tools that return an assembled chart (`get_qimen_chart`, `get_qimen_chart_minute`, `get_golden_mirror_chart`, `check_patterns`) — a handful of non-memoized `@cka4913/qimen-core` helpers (`closedSixwuForXun`, `lookupReference`, and the standalone `panDoor`/`panStar`/`panGod`) return a fresh, unfrozen object per call, which carries no risk because nothing shares it. And "impossible dates are rejected" holds at the MCP tool layer, not for every low-level calendar helper — `currentJieqiStart` and `jieqiOnDay` do not call `assertSupported`.

### P10 — Skill content revision: 年命宮, disclosed defaults ✅
`skills/qimen/SKILL.md` was still written in Cantonese-toned prose inherited from an early draft; rewritten in standard written Chinese throughout (the same cleanup P9 gave the public docs, extended to the one file it had missed).

Two substantive changes, both scoped after checking what upstream actually supports. First: `qimen_ju_name_chaibu`/`qimen_ju_name_zhirun` were being presented as "ask the user, or run both" with no default, which meant every un-scoped question stalled on a clarifying question the user usually didn't have an opinion on. The flow now defaults to 拆補 and says so in the output, with 置閏 offered rather than silently withheld — hard rule 4 was reworded to require the disclosure rather than forbid a default outright.

Second: the user asked whether 年命宮 (anchoring a reading on the querent's birth-year branch, common in some schools for personal-fortune questions) applies here, and whether upstream requires it. It does not — a direct search of `kinqimen.py`, `config.py`, `jieqi.py`, `app.py` and the upstream README turns up zero occurrences of 生年, 命主, 性別, 命宮, or `gender`; `Qimen.__init__` takes only the query moment. 年命宮 is documented as an explicitly optional, non-core supplementary lens: birth year is asked for once and skipped if not given, gender is not asked for at all (it mainly steers multi-year 流年 progression, which is out of scope for a single chart), and the branch-to-palace correspondence reuses the same 12-branch/8-palace table `sixwu.ts` already carries for 閉六戊 — no new engine code, purely a documentation addition, consistent with the project's facts-engine/doctrine split.

### P11 — Month/year pillar exact-term switching ✅
`ganzhi.ts` month and year pillars switched to the exact 節 / 立春 minute from the project's own sxtwl table, closing the internal contradiction between a chart's `節氣` field and its `月柱` on term days (upstream issue #53). Verified independently before coding: the arithmetic `(year-4) mod 60` matches `getYearInGanZhiByLiChun` on all of 1900–2101, and `pillars().month`/`.year` have no downstream consumer (排局, plates, 馬星, 長生, 格局, 閉六戊 read only `.day`/`.hour`/`.ke`), so no 盤面 field changed. Pinned by D9 in `deviations.spec.ts` (month↔節氣 self-consistency, year↔立春, bounded divergence census) plus a per-節 boundary suite; the calendar/hour/minute parity suites now compare only the day/hour/ke pillars directly. See [docs/PORTING-NOTES.md](docs/PORTING-NOTES.md) D9.

### P12 — 找局 (`find_chart_times`) ✅
Scan forward or backward for 時辰 whose plates satisfy a set of conditions — the 擇時 direction, which every other tool is the inverse of.

The matching semantics were not invented. A separate commercial implementation (奇門實用版 v7.88) was probed with a designed experiment whose conclusion rests only on relations *between its own outputs*, so it holds despite that app building 陰遁 charts differently from this engine: three searches on one day returned 12 / 2 / 22 hits, figures that are self-consistent only under per-palace AND, per-palace OR, and the fact that every chart carries all eight gates. Its `查詢數 108` = 12 時辰 × 9 宮 confirmed the matching unit is a palace-hour pair, and its 格局 hits are palace-attributed (`「青龍返首」(兌七宮)`). Protocol, screenshots and data are in `test-case/FINDINGS.md`.

Design consequences: conditions AND within one palace; 格局 is a palace-level condition like any other (so asking for 青龍返首 and 飛鳥跌穴 together correctly yields nothing — one is 戊 over 丙, the other the reverse); the scan stops at `limit` and returns a `scannedThrough` cursor rather than a total it never counted; `maxDays` bounds an unsatisfiable query. Measured: typical 擇時 queries resolve in 1–35 ms scanning 100–500 時辰; an impossible query burns the full five-year budget in 1.6 s and says so.

Incidental cross-check: the search independently reproduced the reference app's `2026-08-08 寅時 兌宮 青龍返首＋生門` hit, on a 陰遁 day where the two engines otherwise diverge.

### P13 — 陰遁 rotation order (D10) ✅
Upstream walks 時家 陰遁 in `艮乾兌坤離巽震坎` — the plain reverse of clockwise with 艮 moved from seventh place to first — while giving 陽遁 the ordinary clockwise walk and 刻家 陰遁 the ordinary reverse. Only that one case is asymmetric, and nothing explains it. This port copied it, and a previous revision of PORTING-NOTES recorded it as a school difference not to be touched.

That was wrong, and wrong for a reason worth naming: **the corpus cannot test it.** The corpus is upstream's own output, so "is upstream right here" is a question it structurally cannot answer. It took charts from a third implementation to see it.

The evidence is clean because 陽遁 was verified first: the two engines agree there field for field, nine palaces by five layers, which isolates any 陰遁 disagreement to the rotation itself rather than to the calendar, bureau or 值符. Substituting the plain reverse removes every 陰遁 disagreement on the transcribed charts; upstream's order does not.

Measured over the corpus: 4,415 陽遁 charts differ in nothing, all 3,809 陰遁 charts differ in sky plate, gates, stars and gods, and the earth plate never differs. The parity suites now skip those four layers on 陰遁 and compare everything else as before; `deviations.spec.ts` D10 carries two reference charts as fixtures and asserts upstream's order would fail them.

### P14 — 十二長生 (D11) ✅
Upstream reads the *day stem's* cycle and re-keys it through a branch-to-stem table, so the stage it reports for a palace does not depend on that palace at all. This engine now reads each palace's own stem at that palace's own branch, which reproduces a reference implementation's 長生 table for all ten stems and flags 入墓 correctly on upstream issue #56's own example.

The shape changed with it, and that is the more interesting half. The four corner palaces cover two branches each, and a stem can be at two different stages across them — 辛 in 巽 is 墓 at 辰 and 死 at 巳, both true. So `PalaceStage` now carries `stages: Array<{branch, stage}>` plus an `entombed` flag, rather than a single label that would have to be invented for half the palaces. 中宮 has no branch and carries none.

A first attempt at this rule claimed corner palaces take the earlier of their two branches, drawn from two 墓 observations. Every corner palace's 墓 branch *is* its earlier one, so 墓 evidence cannot separate that model from the correct one and both observations were guaranteed either way; the 長生 branches, all later ones, are what settle it. Worth remembering as a shape of mistake, not just an instance.

`長生運` now differs from upstream on every chart, so hour-parity stops comparing it and `deviations.spec.ts` D11 holds it to the reference table instead.

---

## Not doing

- **The Streamlit UI, SVG export, LLM report generator.** Out of scope for a facts engine.
- **真太陽時 correction.** Upstream does not do it, so doing it would silently diverge from every published kinqimen chart. If it is ever added it must be an explicit opt-in argument, never a default.

---

## Possible next

Nothing here is committed; listed so the shape of the gap is visible.

- **More 格局.** The engine detects the three upstream implements. The classical canon has dozens (三奇得使, 白虎猖狂, 螣蛇夭矯, 朱雀投江, 青龍逃走…), all of which are pattern matches over the plates and would fit the facts-engine contract cleanly. The blocker is sourcing the conditions from a transmission worth trusting, not the code.
- **旺相休囚死 per palace.** `lookup_reference` exposes the seasonal table; computing it per palace and folding it into the chart would save the agent a step.
- **「任一條件滿足」search mode.** The reference app offers per-palace OR alongside per-palace AND, and `find_chart_times` currently implements only AND. Low value on its own, but cheap once someone wants it.
- **A 用神 helper.** Risky: choosing the 用神 is interpretation, and the engine's line is that interpretation belongs to the agent. If it happens it should return *candidates with their rationale*, never a single answer.
- **#54 中宮寄干.** Confirmed: 中宮's stem never reaches the sky plate. Narrower than first thought — comparing six charts showed this engine's single `禽` entry already corresponds to the reference's `禽芮` cell, so the star layer is structurally right and only the lodged stem is missing. Expected fix is an additive `lodgedStem` field rather than a `skyPlate` type change.
- **#62 置閏.** Confirmed to diverge at 距節氣 7 days; deferred until the correct 超神／接氣 threshold is established.
- **Doctrine review of `SKILL.md`.** The 用神 and 格局 tables are assembled from common doctrine and marked as a draft. They need reconciling against a specific transmission before anyone leans on them.
- **Extending the corpus past 2100.** The solar-term table stops at 2102 and the query range at 2100. Widening both is mechanical.
