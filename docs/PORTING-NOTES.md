# Porting notes

Every place this engine knowingly differs from `kentang2017/kinqimen`, and why.
A deviation that is not listed here is a bug. Each entry that changes output is
pinned by a test in `packages/fixtures/tests/deviations.spec.ts`; the rest are
recorded because a future reader will otherwise assume they were oversights.

The rule throughout: **upstream's output is the specification.** Where upstream
does something odd but consistent, this port does the same odd thing. Only where
upstream is demonstrably broken — producing a result no school of 奇門 would
recognise — does this port depart, and then loudly.

---

## D1 · The hour is read directly, not through `ephem`

**Upstream** routes the query hour through `ephem.Date(...)` and then reads the
hour back out of `.tuple()`. `ephem`'s date is a float64 day number counted from
1899-12-31 12:00, and by mid-2079 it has lost enough precision that
`ephem.Date("2080/01/03 05:00:00")` reads back as `04:59:59.999999`. Upstream
truncates that to hour 4, so the hour branch, the hour pillar, the 值符, the
bureau and therefore the entire chart shift by one position.

The first affected date is **2079-06-06**; every date after it is affected at
some hours, and all dates before it are exact.

**This port** takes the requested hour as given. `ephem` is not a dependency.

**Consequence.** For queries on or after 2079-06-06 this engine disagrees with
upstream, deliberately. `deviations.spec.ts` D1 proves that every such
disagreement is exactly "upstream read the hour one lower" and nothing else, and
that before the breakdown the two agree on every case in the corpus. The parity
suites skip past the breakdown, because upstream's output there is not a valid
target.

---

## D2 · Solar-term moments come from a table, not from an ephemeris

**Upstream** gets solar-term moments from `sxtwl`. This port uses
`lunar-javascript` for the lunar calendar and the ganzhi pillars, but the two
libraries compute solar-term moments from different ephemerides and disagree by
up to about a minute. Upstream truncates the moment to whole minutes, so about a
fifth of all terms in 1900–2100 land on a different minute — and a query inside
that minute lands on a different 局, which is a completely different chart.

**This port** carries the term moments as data: `packages/core/src/data/jieqi-table.ts`
is generated from `sxtwl` itself by `scripts/gen-jieqi-table.py`, covering
1898–2102 at minute precision. Solar-term moments are therefore identical to
upstream's by construction rather than by luck.

The table runs two years wider than the supported query range (1900–2100) at
each end, because a query on the first or last supported day still needs to look
into the neighbouring year.

**Related detail.** Upstream writes `int(t.h), round(t.m)`, which looks like it
rounds the seconds. It does not: `sxtwl` reports whole minutes in `t.m` and the
seconds in a separate `t.s`, so the seconds are discarded. Rounding them instead
would push about two thirds of all terms one minute late — an early version of
this port did exactly that, and the corpus caught it.

---

## D3 · The `lunar-javascript` ganzhi variants were chosen empirically

`sxtwl` and `lunar-javascript` both offer several ganzhi conventions. The
matching pairs were determined by running the corpus, not by reading docs:

| upstream | this port | boundary |
|---|---|---|
| `getYearGZ()` | `getYearInGanZhiByLiChun()` | 立春, day-granular |
| `getMonthGZ()` | `getMonthInGanZhi()` | 節, day-granular |
| `getDayGZ()` | `getDayInGanZhi()` | midnight |

Day-granular matters: on the day of 立春, upstream uses the new year's pillar
from 00:00, not from the term's exact moment. The `Exact` variants would use the
moment, and they disagree with upstream on exactly those days.

The hour pillar is never taken from the library at all. Upstream keeps only the
branch and recomputes the stem by 五鼠遁, so this port computes the branch
arithmetically from the hour and does the same 五鼠遁.

> **Update (D9).** The month and year pillars no longer use the library's
> day-granular variants at all. They switch at the exact 節 / 立春 minute taken
> from this port's own `JIEQI_PACKED` table, so on a term day before the term's
> minute the pillar stays the old one. See D9.

---

## D4 · The sky plate returns one shape

**Upstream's** `Qimen.pan_sky` has four branches. Two of them are unreachable:

- The `fu_head_location == "中"` branch opens with a `try` whose
  `new_list(rotate, "中")` always raises, so only its `except` arm ever runs.
- The branch that returns a *tuple* of two dicts (`aa, bb`) is guarded by
  `if fu_head not in gan_reorder` after a `new_list` that would already have
  raised on that condition, so it never fires. `gong_chengsun` nonetheless
  carries a `try: sky[0] / except KeyError` to cope with the tuple it can never
  receive.
- The fallback at the end raises a bare `ValueError` when the 值符's stem is in
  中宮 and the 值符星 is not 禽.

**This port** returns `Record<string, string>` from `panSky`, always. The
unreachable paths are marked in comments rather than reproduced, and the raise
becomes a `QimenError` with a code. The whole-corpus parity suite is what
justifies the simplification: 4,112 charts × 2 schools agree field for field,
and no case in the corpus reaches the raising path.

**Retained as-is:** when the 值符 sits in 中宮 the sky plate genuinely has only
eight palaces — 中 is absent from the result. That is 中寄坤, not a dropped
field, and clients must handle it.

---

## D5 · 長生運 is keyed by stem, and the collision order matters

Upstream re-keys the twelve-stage table from branches to stems through a fixed
correspondence in which 丑 and 未 both map to 己, and 辰 and 戌 both map to 戊.
Two of the ten stems are therefore written twice, and the later write wins.

"Later" is in the iteration order of the *stage table*, which begins at the
stem's own 長生 branch and so differs per stem. Iterating the branches in their
natural 子丑寅… order instead — the obvious reading — silently changes every 戊
and 己 palace's stage. This port iterates in the rotated order; the corpus caught
the difference immediately.

---

## D6 · 鶴神 is reproduced broken

`Qimen.crane_god` builds its table from nine directions and nine run-lengths,
then zips it against the sixty 甲子 with `range(0, 8)` — so it emits eight
entries, each a *list of one repeated character* rather than a direction, and
covers only the first eight day pillars of a 庚申-anchored cycle. Every other day
gets nothing.

The evident intent was a run-length expansion: 巽 for six days, 離 for five, and
so on across the sixty-day cycle. That is not what the code does.

**This port reproduces the broken behaviour**, because 金函玉鏡 charts published
by kinqimen show that behaviour and "fixing" it would silently change every
chart. `craneGod` is typed `string[] | null`, the tool description says not to
read it as a direction, and the skill repeats the warning.

---

## D7 · The 刻家 sky plate is data, including its typos

`config.pan_sky_minute` is a ladder of 46 `if kook1 in "…"` branches covering 360
局+刻柱 combinations, followed by a computed fallback. Both halves are extracted
mechanically into `packages/core/src/data/ke-sky-plate.ts` by
`scripts/gen-ke-tables.py` rather than retyped, so no transcription error is
possible.

Two things carried over unchanged:

- **A typo'd stem.** One override plate reads `癸壬辛庚己戊乙再丁` — `再` is not
  a Heavenly Stem. It applies to the 陰六甲子 group.
- **Two duplicate keys.** `陰六戊午` and `陽一壬午` each appear in two branches
  with different plates. Python's ladder returns on the first match, so the
  first listing wins; the generator preserves that and reports the duplicates
  when it runs.

---

## D8 · Names and shapes

Cosmetic where they do not change a value, but worth knowing when comparing
against upstream output directly:

- **English field names.** `天盤` → `skyPlate`, `值符值使` → `zhifuZhishi`, and so
  on. Palace keys stay as trigrams (`坎坤震巽中乾兌艮離`) because those are
  identities, not labels.
- **刻家 `旬空` renamed.** Upstream labels the 刻家 pair 日空/時空, but
  `hourkong_minutekong` computes them from the *hour* and *刻* pillars. This port
  calls them `hour` and `ke`.
- **長生運 flattened.** Upstream nests `{palace: {stem: stage}}`; this port uses
  `{palace: {stem, stage}}`. Same information, one less level.
- **格局 absence.** Upstream returns the string `沒有`, and in one branch falls
  off the end and returns `None`. Both become `{ gong: null }`.
- **`pan_html` / `gpan_html` not ported.** HTML generation belongs to the UI.
  `render_chart_text` renders the same nine-palace layout as text instead.

---

## D9 · Month and year pillars switch at the exact term minute

**Upstream** (`jieqi.gangzhi`) takes the month pillar from `sxtwl.getMonthGZ()`
and the year pillar from `sxtwl.getYearGZ()`, both day-granular: the whole 節
day (立春 day for the year) carries the new pillar from 00:00. This port used
`lunar-javascript`'s matching day-granular variants (formerly D3), so on a 節
day before the term's own minute the chart reported `節氣` = the previous term
(whose name is computed against the exact moment) while `月柱` had already
advanced — an internal inconsistency between two fields of the same result
(upstream issue #53).

**This port** now switches the month branch at the exact 節 minute and the year
ganzhi at the exact 立春 minute, both read from this port's own `JIEQI_PACKED`
table (the same sxtwl-derived table D2 introduced, so no second ephemeris is
consulted and the D2 minute-disagreement cannot recur). The month stem follows
by 五虎遁 from the year stem, so the two are fixed together. The month pillar is
therefore always consistent with the `節氣` field of the same chart — the
contradiction #53 reported is gone.

Both boundaries are judged against the **original civil moment**, not the
晚子時-rolled day the *day* pillar uses: 23:00–23:59 is the 子時 attributed to the
following calendar day for the 日柱／時柱 only, and must not advance the year/month
ahead of `節氣`. Without this, a 節 or 立春 in the 23:xx hour or at 00:00 (101 in
the 23:xx hour plus 2 at exactly 00:00, 103 boundaries across 1900–2100) would
see the month/year roll over up to most of an hour before `節氣` does, leaving the
chart self-contradictory again.

**Scope.** `pillars().month` and `pillars().year` are pure output: no
downstream computation consumes them (排局, plates, 馬星, 長生, 格局, 閉六戊 all
read only `.day` / `.hour` / `.ke`), so no 盤面 field changes. `deviations.spec.ts`
D9 pins it three ways — the month pillar is always consistent with the term
period, the year pillar follows 立春 to the minute, and the divergence from
upstream's day-granular corpus is non-zero but bounded (a small minority of
sampled moments, all on term-boundary days). `month-year-boundary.spec.ts` checks
the switch directly for every 節 and for 立春.

**Consequence.** For moments on a 節 day before the term's minute, this engine's
month (and on 立春 day, year) pillar differs from upstream and from every chart
recorded by the day-granular convention, deliberately. The divergence is
occasionally wider than the naïve `[term-day 00:00, term minute)` window,
because upstream's own day-granular month pillar sometimes contradicts its own
`節氣` field — which is precisely the inconsistency D9 removes.

---

## D10 · 陰遁 walks the plain reverse of clockwise

**Upstream** walks the eight outer palaces in `艮乾兌坤離巽震坎` for 時家 陰遁 —
the plain reverse of the clockwise order, but with 艮 lifted from seventh place
to first. 陽遁 gets the ordinary clockwise walk, and 刻家 陰遁 gets the ordinary
reverse, so only this one case is asymmetric, and nothing in the source explains
why.

This port copied it, and an earlier revision of this document recorded it as a
school difference not to be touched. That was the wrong call, and it was wrong
for a structural reason: **the corpus cannot test it.** The corpus *is* upstream's
output, so any question of the form "is upstream right here" is invisible to it.

**This port** uses the plain reverse, `乾兌坤離巽震艮坎`.

**Evidence.** Charts were taken from a third implementation (奇門實用版 v7.88)
and compared field by field. On 陽遁 the two engines already agreed exactly, nine
palaces by five layers, which isolates any 陰遁 disagreement to the rotation
rather than to the calendar, the bureau, or the 值符. On 陰遁 they disagreed —
and substituting the plain reverse removes the disagreement completely on every
陰遁 chart transcribed, while upstream's order does not. Two of those charts are
carried in `deviations.spec.ts` D10 as fixtures. The full experiment, including
the refuted 中宮寄艮 hypothesis it replaced, is in `test-case/FINDINGS.md`.

**Consequence.** Measured over the hour corpus: **4,415 陽遁 charts differ in
nothing**, and **all 3,809 陰遁 charts differ** — in the sky plate, gates, stars
and gods. The earth plate never differs, because it does not use this order.

`hour-parity.spec.ts` therefore skips those four layers on 陰遁 charts (and the
sky half of 長生運, which reads the sky plate), and `patterns-parity.spec.ts`
skips 陰遁 charts entirely, since 格局 are read off the sky plate. Everything
else — pillars, 排局, 節氣, the earth plate, 值符值使, 旬空, 馬星, and the earth
half of 長生運 — is still compared against upstream on every chart in the corpus,
陰遁 included.

**Not yet settled.** `禽`/`芮`/`任` co-location still differs: the reference
implementation shows 天禽 sharing a cell with another star, which this port
cannot represent. That belongs to the 中宮寄干 question (upstream issue #54),
not to this one.

---

## D11 · 十二長生 reads the palace, not the day stem

**Upstream** builds the day stem's twelve-stage cycle, then re-keys it from
branches to stems through a fixed table, and looks the plate's stems up in that.
The stage it reports for a palace therefore does not depend on that palace at
all — move a stem to a different palace and its stage follows it unchanged.

**This port** reads each palace's own stem at that palace's own branch.

**Evidence.** Upstream issue #56 reports that on 2025-07-28 15:00, 癸 in 坤
should be 墓; upstream (and this port before the fix) gave 胎. A reference
implementation (奇門實用版 v7.88) marks 入墓 on its charts and flags both 癸 in
坤 and 辛 in 巽 on that exact chart, and publishes a 長生 reference table listing
which stems reach 長生 in which palace. This port now reproduces that table for
all ten stems.

**The shape changed too, and that is the more interesting half.** The four corner
palaces each cover two branches — 巽 is 辰 and 巳, 坤 is 未 and 申, 艮 is 丑 and
寅, 乾 is 戌 and 亥 — and a stem can be at two different stages across them. 辛
in 巽 is 墓 at 辰 and 死 at 巳, and both are true. So a corner palace does not
have *a* stage, and `PalaceStage` carries `stages: Array<{branch, stage}>` rather
than a single label. 中宮 has no branch and so carries none. An `entombed` flag
is included because 入墓 is the judgement this is actually used for, and it is
well defined where a single label is not.

A first draft of this note claimed corner palaces take the *earlier* of their two
branches. That was wrong, and the way it was wrong is worth keeping: every corner
palace's 墓 branch happens to be its earlier one, so 墓 evidence cannot separate
that model from the correct one, and the two observations it rested on were
guaranteed under either. The 長生 branches are all the *later* ones, which is
what actually settles it.

**Consequence.** `長生運` now differs from upstream on every chart, both 遁, so
`hour-parity.spec.ts` does not compare it at all — the two are different
quantities rather than different values of one. `deviations.spec.ts` D11 holds it
to the reference table and to the issue's own example instead.

---

## Not ported at all

- `app.py` — the Streamlit UI, the SVG chart export, the LLM report generator.
  Only the pure logic of 閉六戊 was lifted out of it, and only the path, not the
  drawing.
- `cerebras_client.py`, `.streamlit/` — deployment concerns of the original app.
- `Qimen.year_yuen` / `Qimen.ypan` — dead code upstream; nothing calls them.
- `config.gong_wangzhuai` — takes no argument and hardcodes `"霜降"`, so it
  returns the same table forever. `lookup_reference` category `jieqi` exposes the
  working `wuxing_strong_week` table instead.
