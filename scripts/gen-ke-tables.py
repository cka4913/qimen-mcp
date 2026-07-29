#!/usr/bin/env python3
"""Emit the two big 刻家 data tables into `packages/core/src/data/`.

Both are transcriptions, not computations, so they are extracted mechanically
from the upstream source rather than retyped:

  * `angan.ts`         — `angan.py`'s 暗干/飛干 table, imported and dumped.
  * `ke-sky-plate.ts`  — the override ladder and fallback orders inside
                         `config.pan_sky_minute`, pulled out by parsing the
                         source. That function is 90 lines of `if kook1 in "…"`
                         with a computed fallback; only the data is carried over.

Run:  scripts/.venv/bin/python scripts/gen-ke-tables.py
"""

import ast
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
UPSTREAM = os.path.join(HERE, "upstream")
OUT_DIR = os.path.join(HERE, "..", "packages", "core", "src", "data")

sys.path.insert(0, UPSTREAM)

from angan import Angan  # noqa: E402

EIGHT_GUA = list("坎坤震巽中乾兌艮離")


def ts_header(*lines):
    return ["/**"] + [f" * {line}" if line else " *" for line in lines] + [" */", ""]


def write(name, lines):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"-> {os.path.relpath(path)}")


def gen_angan():
    lines = ts_header(
        "刻家奇門 暗干 / 飛干, transcribed from `angan.py` by",
        "`scripts/gen-ke-tables.py`. DO NOT EDIT BY HAND.",
        "",
        "Keyed by 陰陽 + 局數 + 刻柱, e.g. `陰三甲子`. Each value is nine 干支 for the",
        "eight palaces plus 中, followed by the 飛干 entry as its tenth element.",
    )
    lines.append("export const ANGAN: Record<string, readonly string[]> = {")
    for key in sorted(Angan):
        values = ", ".join(f'"{v}"' for v in Angan[key])
        lines.append(f'  "{key}": [{values}],')
    lines += ["};", ""]
    write("angan.ts", lines)
    print(f"   {len(Angan)} angan entries")


def gen_ke_sky_plate():
    source = open(os.path.join(UPSTREAM, "config.py"), encoding="utf-8").read()
    func = source[source.index("def pan_sky_minute("):]
    func = func[: func.index("\nif __name__")]

    # 1. The override ladder: `if kook1 in "a,b,c".split(","):` → `return … list("…")`
    overrides = {}
    duplicates = []
    pattern = re.compile(
        r'if kook1 in "([^"]+)"\.split\(","\):\s*\n\s*return dict\(zip\(eight_gua,\s*list\("([^"]+)"\)\)\)'
    )
    for keys, stems in pattern.findall(func):
        assert len(stems) == 9, stems
        for key in keys.split(","):
            # A few keys are listed in two branches with different plates. The
            # ladder returns on the first match, so the first listing wins.
            if key in overrides:
                duplicates.append(key)
                continue
            overrides[key] = stems

    # 2. The fallback tables, read as literals. `list("甲乙")` and `tuple([...])`
    # are not literals as far as `ast.literal_eval` is concerned, so they are
    # rewritten into the equivalent literal before evaluating.
    class Delist(ast.NodeTransformer):
        def visit_Call(self, node):
            self.generic_visit(node)
            if isinstance(node.func, ast.Name) and node.func.id in ("list", "tuple"):
                arg = node.args[0]
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    return ast.List(elts=[ast.Constant(ch) for ch in arg.value], ctx=ast.Load())
                if isinstance(arg, (ast.List, ast.Tuple)):
                    return ast.List(elts=arg.elts, ctx=ast.Load())
            return node

    tree = ast.parse(source)
    fn = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "pan_sky_minute")
    assigns = {}
    wanted = ("kook_setting", "skypan_orders", "orders")
    for node in fn.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id in wanted:
            assigns[node.targets[0].id] = ast.literal_eval(ast.fix_missing_locations(Delist().visit(node.value)))

    kook_setting = assigns["kook_setting"]
    skypan_orders = assigns["skypan_orders"]
    orders = assigns["orders"]

    assert len(kook_setting) == len(skypan_orders) == len(orders) == 3

    lines = ts_header(
        "刻家奇門 天盤, transcribed from `config.pan_sky_minute` by",
        "`scripts/gen-ke-tables.py`. DO NOT EDIT BY HAND.",
        "",
        "Upstream computes this plate from `SKY_PLATE_ORDERS` indexed by the 值符",
        "stem, then overrides ~300 specific 局+刻柱 combinations with hand-fitted",
        "plates. Both halves are carried over verbatim, overrides included: they",
        "are the published behaviour, and one of them (陰六甲子 and its group)",
        "even contains a typo'd stem. See docs/PORTING-NOTES.md.",
    )
    lines.append("/** `局 + 刻柱` → the nine stems, in 坎坤震巽中乾兌艮離 order. */")
    lines.append("export const KE_SKY_OVERRIDES: Record<string, string> = {")
    for key in sorted(overrides):
        lines.append(f'  "{key}": "{overrides[key]}",')
    lines += ["};", ""]

    lines.append("/** The three 局 groups the fallback tables are keyed by. */")
    lines.append("export const KE_KOOK_GROUPS: ReadonlyArray<readonly string[]> = [")
    for group in kook_setting:
        lines.append("  [" + ", ".join(f'"{k}"' for k in group) + "],")
    lines += ["];", ""]

    lines.append("/** Per group: eight candidate plates, each nine stems in 坎坤震巽中乾兌艮離 order. */")
    lines.append("export const KE_SKY_PLATES: ReadonlyArray<readonly string[]> = [")
    for group in skypan_orders:
        lines.append("  [" + ", ".join(f'"{"".join(p)}"' for p in group) + "],")
    lines += ["];", ""]

    lines.append("/** Per group: for each of the six 儀, which plate index each palace takes. */")
    lines.append("export const KE_SKY_PLATE_INDEX: ReadonlyArray<ReadonlyArray<readonly number[]>> = [")
    for group in orders:
        lines.append("  [" + ", ".join("[" + ", ".join(str(n) for n in row) + "]" for row in group) + "],")
    lines += ["];", ""]

    write("ke-sky-plate.ts", lines)
    print(f"   {len(overrides)} override keys, {len(skypan_orders)} groups")
    if duplicates:
        print(f"   {len(duplicates)} key(s) listed twice, first listing kept: {sorted(set(duplicates))}")


if __name__ == "__main__":
    gen_angan()
    gen_ke_sky_plate()
