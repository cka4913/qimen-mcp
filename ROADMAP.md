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
`render-text.ts`, `skills/kinqimen/SKILL.md`, five docs. The skill is held to reality by `skill.spec.ts`, which caught two tools the skill had failed to mention.

### P8 — Review follow-up ✅
An external read-only review found eight issues; all eight are fixed and each has a test.

Two mattered. Impossible dates (`2024-02-30`) were accepted, normalised to another day by the underlying calendar, and charted — while `resolved` still echoed the date nobody asked about. And the memo caches handed out shared mutable objects, so one caller mutating a plate changed every later chart for the same moment. Both broke the determinism the whole project is built on. Dates are now validated against the real month length; every result is deep-frozen.

The rest: a `glossary` argument that was declared but never read (removed — `lookup_reference` already answers that question), two argument errors reported as `INTERNAL_ERROR`, a documented error code with no throw path, a corpus that recorded no upstream revision, and a missing `LICENSE`. `server.spec.ts` and `data.spec.ts` were added to close the gap the review identified: negative paths and table completeness, not just parity.

---

## Not doing

- **The Streamlit UI, SVG export, LLM report generator.** Out of scope for a facts engine.
- **真太陽時 correction.** Upstream does not do it, so doing it would silently diverge from every published kinqimen chart. If it is ever added it must be an explicit opt-in argument, never a default.

---

## Possible next

Nothing here is committed; listed so the shape of the gap is visible.

- **More 格局.** The engine detects the three upstream implements. The classical canon has dozens (三奇得使, 白虎猖狂, 螣蛇夭矯, 朱雀投江, 青龍逃走…), all of which are pattern matches over the plates and would fit the facts-engine contract cleanly. The blocker is sourcing the conditions from a transmission worth trusting, not the code.
- **旺相休囚死 per palace.** `lookup_reference` exposes the seasonal table; computing it per palace and folding it into the chart would save the agent a step.
- **A 用神 helper.** Risky: choosing the 用神 is interpretation, and the engine's line is that interpretation belongs to the agent. If it happens it should return *candidates with their rationale*, never a single answer.
- **Doctrine review of `SKILL.md`.** The 用神 and 格局 tables are assembled from common doctrine and marked as a draft. They need reconciling against a specific transmission before anyone leans on them.
- **Extending the corpus past 2100.** The solar-term table stops at 2102 and the query range at 2100. Widening both is mechanical.
