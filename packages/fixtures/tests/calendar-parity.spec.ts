/**
 * P1 gate: the calendar layer must reproduce upstream's pillars, solar terms
 * and lunar dates for every case in the corpus.
 *
 * `sxtwl` (upstream) and `lunar-javascript` (this port) compute solar-term
 * moments independently, so this suite is where any disagreement between the
 * two ephemerides shows up. It is deliberately loud: a single mismatched
 * minute can move a chart into a different 局.
 */
import { describe, expect, it } from "vitest";
import { currentJieqiStart, jieqiName, lunarDate, pillars } from "@kinqimen/core";
import { label, loadCalendar, toCivil, upstreamHourIsSound } from "../src/index.js";

const all = loadCalendar();

/**
 * Past 2079-06-06 upstream misreads the query hour (a float64 limit in `ephem`;
 * see deviations.spec.ts D1), so its pillars and everything downstream of them
 * are not a valid target. Calendar facts that do not depend on the hour — solar
 * terms, lunar dates — are still checked over the whole corpus.
 */
const corpus = { count: all.count, cases: all.cases.filter((c) => upstreamHourIsSound(c.input)) };
const everyCase = all.cases;

describe("calendar corpus", () => {
  it("is non-trivial and free of upstream errors", () => {
    expect(corpus.count).toBeGreaterThan(10_000);
    expect(everyCase.filter((c) => c.error)).toHaveLength(0);
    // The hour-independent suites below still need to span the full range.
    expect(everyCase.length - corpus.cases.length).toBeGreaterThan(100);
  });
});

describe("pillars match upstream", () => {
  it("year, month, day, hour and ke agree on every case", () => {
    const failures: string[] = [];
    for (const c of corpus.cases) {
      const got = pillars(toCivil(c.input));
      const want = c.ganzhi;
      const mine = [got.year, got.month, got.day, got.hour, got.ke];
      for (let i = 0; i < 5; i++) {
        if (mine[i] !== want[i]) {
          failures.push(`${label(c.input)} pillar[${i}]: got ${mine[i]}, want ${want[i]}`);
          break;
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});

describe("solar terms match upstream", () => {
  it("the term period a moment falls in agrees on every case", () => {
    const failures: string[] = [];
    for (const c of everyCase) {
      const got = jieqiName(toCivil(c.input));
      if (got !== c.jieqi) failures.push(`${label(c.input)}: got ${got}, want ${c.jieqi}`);
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it("the current term's exact moment agrees to the minute on every case", () => {
    const failures: string[] = [];
    for (const c of everyCase) {
      const got = currentJieqiStart(toCivil(c.input));
      const mine = [got.year, got.month, got.day, got.hour, got.minute];
      if (got.name !== c.jieqiStartName || mine.join("-") !== c.jieqiStart.join("-")) {
        failures.push(`${label(c.input)}: got ${got.name} ${mine.join("-")}, want ${c.jieqiStartName} ${c.jieqiStart.join("-")}`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});

describe("lunar dates match upstream", () => {
  it("year, month, month name and day agree on every case", () => {
    const failures: string[] = [];
    for (const c of everyCase) {
      const [y, m, d] = c.input;
      const got = lunarDate(y, m, d);
      if (
        got.year !== c.lunar.year ||
        got.month !== c.lunar.month ||
        got.monthName !== c.lunar.monthName ||
        got.day !== c.lunar.day
      ) {
        failures.push(`${label(c.input)}: got ${JSON.stringify(got)}, want ${JSON.stringify(c.lunar)}`);
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});
