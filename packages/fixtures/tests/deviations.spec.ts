/**
 * Deliberate departures from upstream.
 *
 * Every case where this port knowingly produces something other than
 * `kentang2017/kinqimen` lives here, pinned by a test. A deviation that is not
 * in this file is a bug, and a deviation whose test stops failing upstream is a
 * deviation that should be removed.
 *
 * Prose for each entry is in docs/PORTING-NOTES.md.
 */
import { describe, expect, it } from "vitest";
import { hourBranch, pillars } from "@kinqimen/core";
import {
  EPHEM_PRECISION_BREAKDOWN,
  label,
  loadCalendar,
  toCivil,
  upstreamHourIsSound,
  type CalendarCase,
} from "../src/index.js";

const corpus = loadCalendar();

describe("D1 · the hour is read directly, not through ephem", () => {
  const affected = corpus.cases.filter((c) => !upstreamHourIsSound(c.input));

  it("the corpus actually covers dates past the breakdown", () => {
    expect(affected.length).toBeGreaterThan(100);
  });

  it("every disagreement past the breakdown is upstream reading the hour one lower", () => {
    const unexplained: string[] = [];
    for (const c of affected) {
      const dt = toCivil(c.input);
      const got = pillars(dt);
      if (got.hour === c.ganzhi[3]) continue;
      // Upstream lost a microsecond and truncated into the previous hour. Its
      // hour pillar should be the one this port would produce an hour earlier.
      const oneHourEarlier = pillars({ ...dt, hour: dt.hour === 0 ? 23 : dt.hour - 1 });
      if (oneHourEarlier.hour !== c.ganzhi[3]) {
        unexplained.push(`${label(c.input)}: upstream ${c.ganzhi[3]}, ours ${got.hour}, ours-1h ${oneHourEarlier.hour}`);
      }
    }
    expect(unexplained.slice(0, 10)).toEqual([]);
    expect(unexplained).toHaveLength(0);
  });

  it("this port's hour branch follows the clock, including past the breakdown", () => {
    const b = EPHEM_PRECISION_BREAKDOWN;
    const dt = { year: b.year + 1, month: b.month, day: b.day, hour: 5, minute: 30 };
    expect(hourBranch(dt.hour)).toBe("卯");
    expect(pillars(dt).hour.endsWith("卯")).toBe(true);
  });

  it("before the breakdown the two agree exactly, so the deviation is bounded", () => {
    const sound = corpus.cases.filter((c: CalendarCase) => upstreamHourIsSound(c.input));
    const failures = sound.filter((c) => pillars(toCivil(c.input)).hour !== c.ganzhi[3]);
    expect(failures.map((c) => label(c.input)).slice(0, 10)).toEqual([]);
  });
});
