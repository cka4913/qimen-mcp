#!/usr/bin/env python3
"""Emit `packages/core/src/data/jieqi-table.ts` from sxtwl.

Why a table instead of computing solar terms at runtime:

`lunar-javascript` and `sxtwl` compute solar-term moments from different
ephemerides and disagree by up to about a minute. Upstream truncates the moment
to whole minutes, so roughly a fifth of all terms land on a different minute —
and a query inside that minute produces an entirely different 局. Since the
compatibility target is upstream's output, the honest fix is to carry upstream's
own numbers rather than recompute them.

The table covers 1900–2100 at minute precision, which is exactly the precision
upstream uses (it discards sxtwl's seconds field). ~40 KB of source.

Run:  scripts/.venv/bin/python scripts/gen-jieqi-table.py
"""

import datetime
import os

import sxtwl

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "packages", "core", "src", "data", "jieqi-table.ts")

JQMC = ['小寒', '大寒', '立春', '雨水', '驚蟄', '春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至',
        '小暑', '大暑', '立秋', '處暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至']

# The table runs two years wider than the supported query range at each end:
# `beforeJieqiStart` steps back 15 days and `nextJieqiStart` walks forward, so a
# query on the first or last supported day still needs neighbouring years.
START_YEAR = 1898
END_YEAR = 2102


def terms_of_year(year):
    """The 24 solar terms of a Gregorian year, in chronological order."""
    out = []
    d = datetime.date(year, 1, 1)
    end = datetime.date(year, 12, 31)
    while d <= end:
        day = sxtwl.fromSolar(d.year, d.month, d.day)
        if day.hasJieQi():
            t = sxtwl.JD2DD(day.getJieQiJD())
            # Upstream: int(t.h), round(t.m). sxtwl reports whole minutes with
            # the seconds in a separate field, so this truncates the seconds.
            out.append((JQMC[day.getJieQi() - 1], t.M, t.D, int(t.h), round(t.m)))
        d += datetime.timedelta(days=1)
    return out


def main():
    packed = []
    for year in range(START_YEAR, END_YEAR + 1):
        terms = terms_of_year(year)
        assert len(terms) == 24, f"{year}: got {len(terms)} terms"
        names = [t[0] for t in terms]
        assert names == JQMC, f"{year}: terms out of expected order: {names}"
        packed.append("".join(f"{m:02d}{d:02d}{h:02d}{mi:02d}" for (_, m, d, h, mi) in terms))

    lines = [
        "/**",
        " * Solar-term moments, 1898–2102, generated from sxtwl by",
        " * `scripts/gen-jieqi-table.py`. DO NOT EDIT BY HAND.",
        " *",
        " * These are upstream's own numbers. Recomputing them from a different",
        " * ephemeris (as `lunar-javascript` would) shifts about a fifth of all terms",
        " * by one minute, which is enough to change the 局 for queries inside that",
        " * minute. See docs/PORTING-NOTES.md.",
        " */",
        "",
        f"export const JIEQI_TABLE_START_YEAR = {START_YEAR};",
        f"export const JIEQI_TABLE_END_YEAR = {END_YEAR};",
        "",
        "/**",
        " * One entry per year from `JIEQI_TABLE_START_YEAR`. Each is 24 terms of",
        ' * `"MMDDhhmm"` in chronological order, which is also 小寒…冬至 order.',
        " */",
        "export const JIEQI_PACKED: readonly string[] = [",
    ]
    lines += [f'  "{p}",' for p in packed]
    lines += ["];", ""]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"{len(packed)} years -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
