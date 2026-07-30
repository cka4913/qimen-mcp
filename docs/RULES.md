# The rules the engine follows · 排盤規則

> What the engine actually computes, in the order it computes it. This is the algorithm, not the doctrine — for how to *read* the result see [SKILLS.md](SKILLS.md); for where it departs from upstream see [PORTING-NOTES.md](PORTING-NOTES.md).

---

## 1. From a moment to five pillars

```
civil datetime
  → 23:00 rolls over to the next day at 00:00        (晚子時)
  → 年柱  立春 boundary, exact-minute (D9)
  → 月柱  節 boundary, exact-minute (D9)
  → 日柱  midnight boundary
  → 時柱  branch from the clock hour; stem by 五鼠遁 from the day pillar
  → 刻柱  ten-minute slot; sequence by 五馬遁 from the *unshifted* day's 子時
```

Two details that change charts:

- The 23:00 rollover moves the day pillar *and* the hour pillar forward.
- The 刻 sequence is anchored on the original date's midnight even when the hour is 23. Upstream does this; it is preserved.
- The year and month pillars are judged against the *original* civil moment, not the rolled day (D9), so a 節/立春 in the 23:xx hour keeps month/year in step with `節氣` minute for minute.

---

## 2. From a moment to a solar term

The solar-term moments are a table (1898–2102, minute precision) generated from `sxtwl`. Two lookups matter and they are not the same:

- **The term period a moment is in** (`jieqiName`) — compares against the exact moments, so it changes at the term's minute.
- **The term of the day** (`currentJieqiStart`) — day-granular. A term at 23:58 marks that whole day, including 00:01. The 置閏 day count depends on this, so the coarseness is load-bearing.

---

## 3. 排局 — which bureau

### 拆補法

```
元    ← the day pillar's position in its five-day block (上/中/下)
局    ← the solar term's three-bureau code, indexed by 元
遁    ← 陽 for the twelve terms from 冬至, 陰 for the twelve from 夏至
```

Total. No special cases. `陽遁六局上`.

### 置閏法

```
距節氣日數 d ← whole days from the term's moment to the query
              (+1 when the query is later the same day)
三元         ← the day pillar's 旬首 → 上元/中元/下元
值符天干     ← the 遁甲 stem of the hour pillar's 旬
```

Four candidate bureaux are built from the current, previous and next terms:

| candidate | 遁 from | bureau from |
|---|---|---|
| `current` 當前排局 | this term | this term |
| `chaoshen` 超神接氣正授 | next term | next term |
| `other` 其他排局 | this term | previous term |
| `other1` 其他排局1 | next term | this term |

Then a ladder picks between them on `d`, the lunar month name, the lunar day and whether 值符天干 is one of the six 儀. The bands are `d==0`, `d==1`, `2–6`, `7–9`, `10–15`, and everything else, with the 芒種 and 大雪 置閏 windows short-circuiting ahead of all of them. `get_ju` returns all four candidates plus the workings, so the choice can be shown rather than asserted.

### 刻家

Simplest of the three: 陽遁 for a 子–巳 hour branch, 陰遁 for 午–亥; the bureau numbers do not vary by solar term at all. `陽一局上元`.

---

## 4. The plates

**地盤** — walk the nine palaces from the bureau number, lay the nine stems on them in 陽遁 (`戊己庚辛壬癸丁丙乙`) or 陰遁 (`戊乙丙丁癸壬辛庚己`) order.

**天盤** — rotate the eight outer stems so the 值符's stem leads, then lay them from the 值符's palace. 中 keeps the stem it had. Three cases:

| case | anchor |
|---|---|
| 值符 in 中宮 | 坤 (中寄坤); the plate has **eight** palaces, 中 is absent |
| 值符星 is 禽 | 坤's stem leads, since 禽 is 中宮's star lent to 坤 |
| otherwise | the 值符's own stem and palace |

**Rotation order** differs by 遁 and by chart:

- 時家 陽遁 — `坎艮震巽離坤兌乾` (clockwise)
- 時家 陰遁 — `艮乾兌坤離巽震坎` (a separate order fitted to published 置閏 charts, *not* the reverse of clockwise)
- 刻家 陰遁 — the plain reverse of clockwise

---

## 5. 九星, 八門, 八神

All three are the same move: anchor on the 值符's palace (or 坤 if it is in 中宮), walk the palaces in the bureau's rotation order, lay the sequence on them. 陽遁 runs the sequence forward, 陰遁 backward.

- 九星 from the 值符星, sequence `蓬任沖輔英禽柱心`
- 八門 from the 值使門, sequence `休生傷杜景死驚開`
- 八神 always from `符蛇陰合…`, ending `勾雀地天` in 陽遁 and `虎玄地天` in 陰遁

The 值符 and 值使 themselves come from per-bureau string tables: each 旬 gets a string whose first character is its starting palace and whose remaining characters give the palace for each of the ten stems in turn.

---

## 6. The rest

- **旬空** — the 孤 pair of the relevant 旬. 時家 reports the day's and the hour's; 刻家 the hour's and the 刻's.
- **馬星** — 天馬 from the day branch, 丁馬 from the day 旬, 驛馬 from the hour branch's 三合 group.
- **十二長生** — the day stem's cycle, re-keyed from branches to stems, then read for every palace of both plates.
- **暗干 / 飛干** (刻家 only) — a 360-row lookup on 局+刻柱.
- **金函玉鏡** — day pillar only. 天乙 starts on a palace that cycles through the sixty days; the other eight 金函 stars follow. 休門's palace advances one step every three days; the other seven gates follow.
- **格局** — 青龍返首 (sky 戊 over earth 丙), 飛鳥跌穴 (sky 丙 over earth 戊), 玉女守門 (earth 丁 in the 值使門's palace).
- **閉六戊** — 旬首 → the branch 戊 occupies → a circuit of the six yang branches, anticlockwise (演義版) or clockwise (寶鑑版).
