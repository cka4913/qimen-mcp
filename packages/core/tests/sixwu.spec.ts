/**
 * 閉六戊 has no upstream corpus — it lives in the Streamlit UI, which the port
 * does not carry over — so it is checked against the rule directly.
 */
import { describe, expect, it } from "vitest";
import { closedSixwu, closedSixwuForXun } from "../src/index.js";

const XUN_TO_BRANCH: Record<string, string> = {
  甲子: "辰", 甲戌: "寅", 甲申: "子", 甲午: "戌", 甲辰: "申", 甲寅: "午",
};

describe("閉六戊", () => {
  it("starts on the branch 戊 occupies for that 旬", () => {
    for (const [xun, branch] of Object.entries(XUN_TO_BRANCH)) {
      expect(closedSixwuForXun(xun, "yanyi").wuBranch).toBe(branch);
      expect(closedSixwuForXun(xun, "yanyi").path[0]?.branch).toBe(branch);
    }
  });

  it("walks all six yang branches and closes the circuit", () => {
    for (const xun of Object.keys(XUN_TO_BRANCH)) {
      for (const version of ["yanyi", "baojian"] as const) {
        const { path } = closedSixwuForXun(xun, version);
        expect(path).toHaveLength(7);
        expect(new Set(path.slice(0, 6).map((s) => s.branch)).size).toBe(6);
        expect(path[6]?.branch).toBe(path[0]?.branch);
        expect(path.every((s) => "子寅辰午申戌".includes(s.branch))).toBe(true);
      }
    }
  });

  it("the two transmissions run in opposite directions", () => {
    const yanyi = closedSixwuForXun("甲子", "yanyi").path.map((s) => s.branch);
    const baojian = closedSixwuForXun("甲子", "baojian").path.map((s) => s.branch);
    expect(yanyi).toEqual(["辰", "寅", "子", "戌", "申", "午", "辰"]);
    expect(baojian).toEqual(["辰", "午", "申", "戌", "子", "寅", "辰"]);
  });

  it("maps each branch to its palace", () => {
    const { path } = closedSixwuForXun("甲申", "baojian");
    expect(path.map((s) => s.gong)).toEqual(["坎", "艮", "巽", "離", "坤", "乾", "坎"]);
  });

  it("takes its 旬 from the hour pillar", () => {
    // 2024-06-15 14:30 is 癸未時, in the 甲戌 旬 → 戊 sits on 寅.
    const path = closedSixwu({ year: 2024, month: 6, day: 15, hour: 14, minute: 30 }, "yanyi");
    expect(path.xunHead).toBe("甲戌");
    expect(path.wuBranch).toBe("寅");
  });
});
