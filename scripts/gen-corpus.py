#!/usr/bin/env python3
"""Generate the golden corpus by running the upstream Python engine.

This script is NOT part of CI and NOT part of the build. It is run by hand
whenever the corpus needs regenerating, and its output is committed under
`packages/fixtures/data/`. The TypeScript port is then held to that output by
`packages/fixtures/tests/parity.spec.ts`.

Setup (once):

    python3 -m venv scripts/.venv
    scripts/.venv/bin/pip install sxtwl==2.0.6 ephem==4.1.6 bidict==0.23.1
    git clone https://github.com/kentang2017/kinqimen scripts/upstream
    git -C scripts/upstream checkout <UPSTREAM_REVISION below>

Both `scripts/.venv/` and `scripts/upstream/` are gitignored: the upstream tree
is a build input, not part of this repository.

**Pin the upstream revision.** The corpus is a recording of one specific
version of upstream; regenerating against a later HEAD and comparing the result
to the old baseline compares two different programs. Every corpus file records
the commit it was generated from, and this script refuses to run against a
different one unless you update `UPSTREAM_REVISION` deliberately.

Usage:

    scripts/.venv/bin/python scripts/gen-corpus.py calendar
    scripts/.venv/bin/python scripts/gen-corpus.py ju
    scripts/.venv/bin/python scripts/gen-corpus.py hour
    scripts/.venv/bin/python scripts/gen-corpus.py minute
    scripts/.venv/bin/python scripts/gen-corpus.py golden
    scripts/.venv/bin/python scripts/gen-corpus.py patterns
    scripts/.venv/bin/python scripts/gen-corpus.py all
"""

import datetime
import gzip
import json
import os
import subprocess
import sys

#: The upstream commit this corpus is a recording of. Bump deliberately, then
#: regenerate every stage and re-run the parity suites — a bump that changes
#: engine behaviour should show up as a corpus diff and a test failure, not as
#: a silent shift in the baseline.
UPSTREAM_REVISION = "f4c6118665253f897889290d8630f9b4cb3a4404"

#: Pinned because they compute the numbers being recorded.
UPSTREAM_DEPENDENCIES = {"sxtwl": "2.0.6", "ephem": "4.1.6", "bidict": "0.23.1"}

HERE = os.path.dirname(os.path.abspath(__file__))
UPSTREAM = os.path.join(HERE, "upstream")
OUT_DIR = os.path.join(HERE, "..", "packages", "fixtures", "data")

sys.path.insert(0, UPSTREAM)

import config  # noqa: E402
import jieqi  # noqa: E402
import kinqimen  # noqa: E402


def upstream_head():
    """The commit `scripts/upstream` is checked out at."""
    try:
        return subprocess.check_output(
            ["git", "-C", UPSTREAM, "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def check_upstream_revision():
    head = upstream_head()
    if head is None:
        raise SystemExit(
            f"cannot read the upstream revision from {UPSTREAM}.\n"
            "Clone it with its git metadata intact so the corpus can record what it was generated from."
        )
    if head != UPSTREAM_REVISION:
        raise SystemExit(
            f"upstream is at {head}, but this corpus is pinned to {UPSTREAM_REVISION}.\n"
            f"Either `git -C {UPSTREAM} checkout {UPSTREAM_REVISION}`, or update UPSTREAM_REVISION\n"
            "in this script and regenerate every stage."
        )
    return head


# ---------------------------------------------------------------- sampling ---

def _dt(y, m, d, h, mi):
    return (y, m, d, h, mi)


def jieqi_boundary_samples(years, step_minutes=10, window_hours=2):
    """Every solar term in `years`, sampled densely on both sides of its moment.

    This is where a 1-minute disagreement between sxtwl and lunar-javascript
    would surface as a different 局, so it gets the densest coverage.
    """
    out = []
    for y in years:
        for m in range(1, 13):
            for d in (1, 15):
                try:
                    jq = jieqi.get_jieqi_start_date(y, m, d, 12, 0)
                except Exception:
                    continue
                t = jq["時間"]
                start = t - datetime.timedelta(hours=window_hours)
                n = int((2 * window_hours * 60) / step_minutes) + 1
                for i in range(n):
                    c = start + datetime.timedelta(minutes=i * step_minutes)
                    out.append(_dt(c.year, c.month, c.day, c.hour, c.minute))
    return out


def uniform_samples(years, days=(3, 9, 17, 23, 28), hours=(0, 5, 11, 17, 23)):
    out = []
    for y in years:
        for m in range(1, 13):
            for d in days:
                for h in hours:
                    out.append(_dt(y, m, d, h, 30))
    return out


def ke_boundary_samples(days, hours=range(24)):
    """Every 10-minute 刻 boundary, plus the minute either side of it."""
    out = []
    for (y, m, d) in days:
        for h in hours:
            for base in (0, 10, 20, 30, 40, 50):
                for off in (0, 1, 9):
                    mi = base + off
                    if mi < 60:
                        out.append(_dt(y, m, d, h, mi))
    return out


def zhirun_window_samples(years):
    """芒種→夏至 and 大雪→冬至: the 置閏 windows, plus 冬至/夏至 themselves."""
    out = []
    for y in years:
        for (m, d0) in ((6, 1), (12, 1), (6, 18), (12, 18)):
            for k in range(24):
                c = datetime.datetime(y, m, d0) + datetime.timedelta(days=k)
                for h in (1, 7, 13, 19):
                    out.append(_dt(c.year, c.month, c.day, h, 0))
    return out


# The engine supports 1900-2100; sampling around terms near those edges can spill
# a few minutes outside it, and those inputs are out of scope rather than failures.
MIN_YEAR = 1900
MAX_YEAR = 2100


def dedupe(samples):
    return sorted({s for s in set(samples) if MIN_YEAR <= s[0] <= MAX_YEAR})


# ------------------------------------------------------------------ stages ---

def _sample_set_calendar():
    return dedupe(
        uniform_samples(range(1900, 2101, 3))
        + jieqi_boundary_samples(range(2020, 2031))
        + jieqi_boundary_samples([1900, 1901, 1950, 2099, 2100], step_minutes=30)
        + ke_boundary_samples([(2024, 6, 15), (2000, 2, 29), (2026, 1, 1)])
        + [_dt(y, 12, 31, 23, 55) for y in range(1900, 2101, 2)]
        + [_dt(y, 1, 1, 0, 5) for y in range(1900, 2101, 2)]
    )


def _sample_set_ju():
    return dedupe(
        uniform_samples(range(1950, 2051, 2))
        + jieqi_boundary_samples(range(2015, 2036), step_minutes=20)
        + zhirun_window_samples(range(2018, 2033))
    )


def _sample_set_chart():
    return dedupe(
        uniform_samples(range(1960, 2051, 7), days=(5, 15, 25), hours=(1, 9, 15, 23))
        + jieqi_boundary_samples(range(2023, 2028), step_minutes=60)
        + zhirun_window_samples(range(2023, 2028))
    )


def _sample_set_minute():
    return dedupe(
        ke_boundary_samples([(2024, 6, 15), (2024, 12, 22), (2025, 3, 20)], hours=(0, 6, 12, 18, 23))
        + uniform_samples(range(1990, 2051, 10), days=(8, 20), hours=(3, 11, 21))
    )


def gen_calendar():
    cases = []
    for (y, m, d, h, mi) in _sample_set_calendar():
        try:
            gz = jieqi.gangzhi(y, m, d, h, mi)
            jqs = jieqi.get_jieqi_start_date(y, m, d, h, mi)
            lunar = jieqi.lunar_date_d(y, m, d)
            cases.append({
                "input": [y, m, d, h, mi],
                "ganzhi": gz,
                "jieqi": jieqi.jq(y, m, d, h, mi),
                "jieqiStart": [jqs["年"], jqs["月"], jqs["日"], jqs["時"], jqs["分"]],
                "jieqiStartName": jqs["節氣"],
                "lunar": {"year": lunar["年"], "monthName": lunar["農曆月"], "month": lunar["月"], "day": lunar["日"]},
            })
        except Exception as e:  # upstream raises on some out-of-table dates
            cases.append({"input": [y, m, d, h, mi], "error": type(e).__name__})
    return cases


def gen_ju():
    cases = []
    for (y, m, d, h, mi) in _sample_set_ju():
        try:
            raw = config.qimen_ju_name_zhirun_raw(y, m, d, h, mi)
            cases.append({
                "input": [y, m, d, h, mi],
                "chaibu": config.qimen_ju_name_chaibu(y, m, d, h, mi),
                "zhirun": config.qimen_ju_name_zhirun(y, m, d, h, mi),
                "ke": config.qimen_ju_name_ke(y, m, d, h, mi),
                "raw": {
                    "jieqi": raw["節氣"],
                    "daysFromJieqi": raw["距節氣差日數"],
                    "sanyuan": raw["三元"],
                    "zhifuStem": raw["值符天干"],
                    "jieqiJu": raw["節氣排局"],
                    "yinyang": raw["陰陽局"],
                    "current": raw["當前排局"],
                    "chaoshen": raw["超神接氣正授排局"],
                    "other": raw["其他排局"],
                    "other1": raw["其他排局1"],
                },
            })
        except Exception as e:
            cases.append({"input": [y, m, d, h, mi], "error": type(e).__name__})
    return cases


def _jsonable(o):
    if isinstance(o, dict):
        return {str(k): _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    if isinstance(o, datetime.datetime):
        return o.isoformat(timespec="minutes")
    return o


def gen_hour():
    cases = []
    for (y, m, d, h, mi) in _sample_set_chart():
        entry = {"input": [y, m, d, h, mi]}
        for opt, key in ((1, "chaibu"), (2, "zhirun")):
            try:
                entry[key] = _jsonable(kinqimen.Qimen(y, m, d, h, mi).pan(opt))
            except Exception as e:
                entry[key] = {"__error__": type(e).__name__}
        cases.append(entry)
    return cases


def gen_minute():
    cases = []
    for (y, m, d, h, mi) in _sample_set_minute():
        entry = {"input": [y, m, d, h, mi]}
        for opt, key in ((1, "chaibu"), (2, "zhirun")):
            try:
                entry[key] = _jsonable(kinqimen.Qimen(y, m, d, h, mi).pan_minute(opt))
            except Exception as e:
                entry[key] = {"__error__": type(e).__name__}
        cases.append(entry)
    return cases


def gen_golden():
    cases = []
    for (y, m, d, h, mi) in _sample_set_chart():
        try:
            cases.append({"input": [y, m, d, h, mi], "gpan": _jsonable(kinqimen.Qimen(y, m, d, h, mi).gpan())})
        except Exception as e:
            cases.append({"input": [y, m, d, h, mi], "error": type(e).__name__})
    return cases


def gen_patterns():
    cases = []
    for (y, m, d, h, mi) in _sample_set_chart():
        entry = {"input": [y, m, d, h, mi]}
        for opt, key in ((1, "chaibu"), (2, "zhirun")):
            q = kinqimen.Qimen(y, m, d, h, mi)
            slot = {}
            for name, fn in (("greenDragon", q.green_dragon), ("flyBird", q.fly_bird), ("jadeGirl", q.jade_girl)):
                try:
                    slot[name] = _jsonable(fn(opt))
                except Exception as e:
                    slot[name] = {"__error__": type(e).__name__}
            entry[key] = slot
        cases.append(entry)
    return cases


STAGES = {
    "calendar": gen_calendar,
    "ju": gen_ju,
    "hour": gen_hour,
    "minute": gen_minute,
    "golden": gen_golden,
    "patterns": gen_patterns,
}


def write(name, cases):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{name}.json.gz")
    payload = {
        "generatedBy": "scripts/gen-corpus.py",
        "upstream": "kentang2017/kinqimen",
        # Which upstream, exactly. Without this a regenerated corpus cannot be
        # told apart from the one the parity suites were written against.
        "upstreamRevision": UPSTREAM_REVISION,
        "upstreamDependencies": UPSTREAM_DEPENDENCIES,
        "stage": name,
        "count": len(cases),
        "cases": cases,
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # mtime=0 keeps the file byte-identical across regenerations, so a corpus
    # that did not change does not show up as a diff.
    with open(path, "wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=9, mtime=0) as f:
            f.write(blob)
    print(f"{name}: {len(cases)} cases -> {os.path.relpath(path)} ({len(blob)/1024:.0f} KiB raw)")


def main():
    check_upstream_revision()
    which = sys.argv[1:] or ["all"]
    if which == ["all"]:
        which = list(STAGES)
    for name in which:
        if name not in STAGES:
            raise SystemExit(f"unknown stage {name!r}; known: {', '.join(STAGES)}")
        write(name, STAGES[name]())


if __name__ == "__main__":
    main()
