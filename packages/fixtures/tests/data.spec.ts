/**
 * Structural checks on the generated tables.
 *
 * The parity suites prove the engine agrees with upstream on the inputs the
 * corpus happens to sample. These prove the *tables* are complete and
 * well-formed for every input, sampled or not — which is what lets the docs say
 * that `ANGAN_NOT_FOUND` and friends are guards rather than routine outcomes.
 *
 * They also guard the generators: `scripts/gen-*.py` rewrite these files
 * wholesale, and a generator that silently emitted a short table would
 * otherwise only show up as a mysterious runtime error much later.
 */
import { describe, expect, it } from "vitest";
import { ANGAN } from "@kinqimen/core/dist/data/angan.js";
import {
  JIEQI_PACKED,
  JIEQI_TABLE_END_YEAR,
  JIEQI_TABLE_START_YEAR,
} from "@kinqimen/core/dist/data/jieqi-table.js";
import {
  KE_KOOK_GROUPS,
  KE_SKY_OVERRIDES,
  KE_SKY_PLATE_INDEX,
  KE_SKY_PLATES,
} from "@kinqimen/core/dist/data/ke-sky-plate.js";
import { DI_ZHI, JIAZI, TIAN_GAN, daysInMonth, jieqiOnDay, MAX_YEAR, MIN_YEAR } from "@kinqimen/core";
import { UPSTREAM_REVISION, loadStage, type StageName } from "../src/index.js";

/** The six bureaux the 刻家 tables are keyed by. */
const KE_KOOKS = ["陽一", "陽四", "陽七", "陰九", "陰六", "陰三"];

describe("六十甲子", () => {
  it("is sixty distinct pillars in stem/branch lockstep", () => {
    expect(JIAZI).toHaveLength(60);
    expect(new Set(JIAZI).size).toBe(60);
    JIAZI.forEach((pillar, i) => {
      expect(pillar[0]).toBe(TIAN_GAN[i % 10]);
      expect(pillar[1]).toBe(DI_ZHI[i % 12]);
    });
  });
});

describe("solar-term table", () => {
  it("covers every year in its declared span", () => {
    expect(JIEQI_PACKED).toHaveLength(JIEQI_TABLE_END_YEAR - JIEQI_TABLE_START_YEAR + 1);
  });

  it("runs wider than the supported query range at both ends", () => {
    // A query on the first or last supported day still looks into its neighbours.
    expect(JIEQI_TABLE_START_YEAR).toBeLessThan(MIN_YEAR);
    expect(JIEQI_TABLE_END_YEAR).toBeGreaterThan(MAX_YEAR);
  });

  it("holds 24 well-formed, chronologically ordered terms per year", () => {
    JIEQI_PACKED.forEach((packed, i) => {
      const year = JIEQI_TABLE_START_YEAR + i;
      expect(packed, `${year}`).toHaveLength(24 * 8);
      let previous = -1;
      for (let t = 0; t < 24; t++) {
        const [month, day, hour, minute] = [0, 2, 4, 6].map((o) => Number(packed.slice(t * 8 + o, t * 8 + o + 2)));
        expect(month, `${year} term ${t} month`).toBeGreaterThanOrEqual(1);
        expect(month, `${year} term ${t} month`).toBeLessThanOrEqual(12);
        expect(day, `${year} term ${t} day`).toBeGreaterThanOrEqual(1);
        expect(day, `${year} term ${t} day`).toBeLessThanOrEqual(daysInMonth(year, month as number));
        expect(hour, `${year} term ${t} hour`).toBeLessThanOrEqual(23);
        expect(minute, `${year} term ${t} minute`).toBeLessThanOrEqual(59);
        const stamp = ((month as number) * 31 + (day as number)) * 1440 + (hour as number) * 60 + (minute as number);
        expect(stamp, `${year} term ${t} is out of order`).toBeGreaterThan(previous);
        previous = stamp;
      }
    });
  });

  it("puts exactly 24 term days in every supported year", () => {
    // Guards the lookup as well as the data: `jieqiOnDay` must find each one.
    for (const year of [MIN_YEAR, 1984, 2024, 2050, MAX_YEAR]) {
      let found = 0;
      for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= daysInMonth(year, month); day++) {
          if (jieqiOnDay(year, month, day)) found++;
        }
      }
      expect(found, `${year}`).toBe(24);
    }
  });
});

describe("暗干 table", () => {
  it("covers all six bureaux × sixty 刻柱 with no gaps", () => {
    expect(Object.keys(ANGAN)).toHaveLength(KE_KOOKS.length * 60);
    const missing: string[] = [];
    for (const kook of KE_KOOKS) {
      for (const pillar of JIAZI) {
        if (!(`${kook}${pillar}` in ANGAN)) missing.push(`${kook}${pillar}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every row nine palace entries plus a 飛干", () => {
    for (const [key, row] of Object.entries(ANGAN)) {
      expect(row, key).toHaveLength(10);
      for (const entry of row) expect(entry, key).toHaveLength(2);
    }
  });
});

describe("刻家 sky-plate tables", () => {
  it("groups the six bureaux into three pairs, covering each exactly once", () => {
    expect(KE_KOOK_GROUPS.flat().sort()).toEqual([...KE_KOOKS].sort());
  });

  it("gives every group eight nine-stem plates and six index rows", () => {
    expect(KE_SKY_PLATES).toHaveLength(KE_KOOK_GROUPS.length);
    expect(KE_SKY_PLATE_INDEX).toHaveLength(KE_KOOK_GROUPS.length);
    KE_SKY_PLATES.forEach((plates, i) => {
      expect(plates, `group ${i}`).toHaveLength(8);
      for (const plate of plates) expect(plate, `group ${i}`).toHaveLength(9);
    });
    KE_SKY_PLATE_INDEX.forEach((rows, i) => {
      expect(rows, `group ${i}`).toHaveLength(6);
      for (const row of rows) {
        expect(row, `group ${i}`).toHaveLength(9);
        // Every index must address a plate that exists.
        for (const n of row) expect(n, `group ${i}`).toBeLessThan(8);
      }
    });
  });

  it("keys every override by a real bureau and a real 刻柱", () => {
    for (const key of Object.keys(KE_SKY_OVERRIDES)) {
      expect(KE_KOOKS, key).toContain(key.slice(0, 2));
      expect(JIAZI, key).toContain(key.slice(2));
      expect(KE_SKY_OVERRIDES[key], key).toHaveLength(9);
    }
  });

  it("still carries upstream's typo'd stem, so removing it is a deliberate act", () => {
    // 再 is not a Heavenly Stem. See docs/PORTING-NOTES.md D7 — reproduced on
    // purpose, because published kinqimen charts show it.
    const typos = Object.entries(KE_SKY_OVERRIDES).filter(([, plate]) => plate.includes("再"));
    expect(typos.map(([key]) => key)).toContain("陰六甲子");
  });
});

describe("corpus provenance", () => {
  it("every stage records the upstream commit and dependency versions it was made from", () => {
    const stages: StageName[] = ["calendar", "ju", "hour", "minute", "golden", "patterns"];
    for (const stage of stages) {
      const file = loadStage(stage);
      expect(file.stage, stage).toBe(stage);
      expect(file.upstream, stage).toBe("kentang2017/kinqimen");
      // A corpus regenerated against a different upstream is a different
      // baseline, and comparing against it would prove nothing.
      expect(file.upstreamRevision, stage).toBe(UPSTREAM_REVISION);
      expect(file.upstreamDependencies?.sxtwl, stage).toBeTruthy();
      expect(file.count, stage).toBe(file.cases.length);
      expect(file.count, stage).toBeGreaterThan(0);
    }
  });
});
