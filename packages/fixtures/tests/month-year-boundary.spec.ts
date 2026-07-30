/**
 * D9: the month and year pillars must switch at the solar term's exact minute,
 * using THIS port's own sxtwl-derived table as the oracle (not lunar-javascript's
 * ephemeris, which disagrees by up to a minute — see docs/PORTING-NOTES.md D2).
 *
 * The comprehensive proof over real data lives in deviations.spec.ts (D9), which
 * shows the exact-term pillars diverge from upstream's day-granular ones. This
 * file is a focused, readable supplement: for each 節 and for 立春 it checks that
 * the pillar actually changes across the boundary, and — for terms that do not
 * fall in the 23:xx or 00:00 edge hours — that the switch lands on the minute.
 */
import { describe, expect, it } from "vitest";
import { addDays, jieqiMomentInYear, pillars, JIAZI } from "@kinqimen/core";

type Moment = { year: number; month: number; day: number; hour: number; minute: number };

/** Shift a moment by whole minutes, rolling hour/day as needed. */
function shiftMinute(m: Moment, delta: number): Moment {
  const total = m.hour * 60 + m.minute + delta;
  const dayDelta = Math.floor(total / 1440);
  const rem = ((total % 1440) + 1440) % 1440;
  const d = addDays({ year: m.year, month: m.month, day: m.day }, dayDelta);
  return { year: d.year, month: d.month, day: d.day, hour: Math.floor(rem / 60), minute: rem % 60 };
}

const atNoon = (m: Moment, dayDelta: number): Moment => {
  const d = addDays({ year: m.year, month: m.month, day: m.day }, dayDelta);
  return { year: d.year, month: d.month, day: d.day, hour: 12, minute: 0 };
};

const ganzhiOfYear = (year: number) => JIAZI[((((year - 4) % 60) + 60) % 60)];
const ganzhiOfPrevYear = (year: number) => JIAZI[(((((year - 1) - 4) % 60) + 60) % 60)];

const JIE = ["立春", "驚蟄", "清明", "立夏", "芒種", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "小寒"];
const YEARS = [1924, 1969, 2005, 2024, 2099];

describe("the month pillar changes across the 節 boundary", () => {
  for (const year of YEARS) {
    for (const jie of JIE) {
      const m = jieqiMomentInYear(year, jie);
      it(`${jie} ${year}: the day before differs from the day after`, () => {
        const before = pillars(atNoon(m, -1)).month;
        const after = pillars(atNoon(m, +1)).month;
        expect(before).not.toBe(after);
      });

      // Minute-precision only where "one minute either way" stays on the same
      // civil day. A term in the 23:xx hour means every query from 23:00 rolls
      // to the next day (晚子時) and past the term; a 00:00 term means the minute
      // before is 23:59 of the previous day, which also rolls. Both edges are
      // still covered by the day-before/day-after check above.
      if (m.hour >= 1 && m.hour <= 22) {
        it(`${jie} ${year}: the switch lands on the term minute`, () => {
          const before = pillars(shiftMinute(m, -1)).month;
          const at = pillars(m).month;
          const after = pillars(shiftMinute(m, +1)).month;
          expect(before).not.toBe(at);
          expect(at).toBe(after);
        });
      }
    }
  }
});

describe("jieqiMomentInYear rejects unknown term names (P2)", () => {
  it("throws on a name not in JIEQI_SXTWL_ORDER instead of silently slicing the tail", () => {
    expect(() => jieqiMomentInYear(2024, "不存在")).toThrow(/not a solar term/);
  });

  it("still resolves a real name", () => {
    expect(jieqiMomentInYear(2024, "立春").name).toBe("立春");
  });
});

describe("the year pillar changes across the 立春 boundary", () => {
  for (const year of YEARS) {
    const m = jieqiMomentInYear(year, "立春");
    it(`立春 ${year}: rolls to the new ganzhi year`, () => {
      expect(pillars(atNoon(m, -1)).year).toBe(ganzhiOfPrevYear(year));
      expect(pillars(atNoon(m, +1)).year).toBe(ganzhiOfYear(year));
    });

    if (m.hour >= 1 && m.hour <= 22) {
      it(`立春 ${year}: the switch lands on the term minute`, () => {
        expect(pillars(shiftMinute(m, -1)).year).toBe(ganzhiOfPrevYear(year));
        expect(pillars(m).year).toBe(ganzhiOfYear(year));
        expect(pillars(shiftMinute(m, +1)).year).toBe(ganzhiOfYear(year));
      });
    }
  }
});
