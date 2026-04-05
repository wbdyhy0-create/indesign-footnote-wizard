#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
הזזת ניקוד / סימני עיגון בטבלת GPOS (OpenType) — בעיקר MarkToBase / MarkToLigature / MarkToMark.

דוגמאות:
  python adjust_nikkud_gpos.py font.ttf -o font_shifted.ttf --dx 40 --hebrew-marks
  python adjust_nikkud_gpos.py font.ttf --list-hebrew-marks
  python adjust_nikkud_gpos.py font.ttf -o out.ttf --dx 30 --unicode-ranges 05C1-05C2

הערות:
  - ההזזה היא ביחידות גופן (FUnits), לא בפיקסלים.
  - רק עוגנים בפורמט 1 (XCoordinate, YCoordinate) מעודכנים; פורמטים עם Device נשארים ללא שינוי.
  - גופנים שונים משתמשים בשמות גליף שונים (uni05C1, afii57799 וכו') — בדקו עם --list.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Callable, Iterable, List, Optional, Set, Tuple

from fontTools.ttLib import TTFont

# טווחי ברירת מחדל: ניקוד עברי + נקודות שין/סין ודומים (לא כולל אותיות)
HEBREW_MARK_UNICODE_RANGES: Tuple[Tuple[int, int], ...] = (
    (0x0591, 0x05C7),
    (0x05F0, 0x05F4),
    (0xFB1E, 0xFB1E),
)


def _unwrap_extension(subtable: object) -> object:
    while hasattr(subtable, "ExtSubTable"):
        subtable = subtable.ExtSubTable
    return subtable


def _iter_gpos_subtables(font: TTFont) -> Iterable[Tuple[int, int, object]]:
    if "GPOS" not in font:
        return
    gpos = font["GPOS"].table
    for li, lookup in enumerate(gpos.LookupList.Lookup):
        for sj, sub in enumerate(lookup.SubTable):
            yield li, sj, _unwrap_extension(sub)


def _parse_ranges(spec: str) -> List[Tuple[int, int]]:
    out: List[Tuple[int, int]] = []
    for part in spec.replace(",", " ").split():
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            lo, hi = int(a, 16), int(b, 16)
        else:
            cp = int(part, 16)
            lo = hi = cp
        out.append((lo, hi))
    return out


def _in_ranges(cp: int, ranges: Iterable[Tuple[int, int]]) -> bool:
    return any(lo <= cp <= hi for lo, hi in ranges)


def _best_cmap_unicode_to_name(font: TTFont) -> dict[int, str]:
    cmap = font.getBestCmap()
    if not cmap:
        return {}
    return {int(k): v for k, v in cmap.items() if isinstance(k, int)}


def _glyph_names_for_ranges(
    uni_map: dict[int, str], ranges: Iterable[Tuple[int, int]]
) -> Set[str]:
    names: Set[str] = set()
    for cp, gname in uni_map.items():
        if _in_ranges(cp, ranges):
            names.add(gname)
    return names


def _parse_glyph_names(font: TTFont, spec: str) -> Set[str]:
    gs = set(font.getGlyphOrder())
    out: Set[str] = set()
    for part in spec.replace(",", " ").split():
        part = part.strip()
        if not part:
            continue
        if part not in gs:
            raise SystemExit(f"גליף לא קיים בגופן: {part}")
        out.add(part)
    return out


def _shift_anchor_xy(anchor: object, dx: int, dy: int) -> bool:
    if anchor is None:
        return False
    fmt = getattr(anchor, "Format", None)
    if fmt != 1:
        return False
    if not hasattr(anchor, "XCoordinate") or not hasattr(anchor, "YCoordinate"):
        return False
    anchor.XCoordinate = int(anchor.XCoordinate) + dx
    anchor.YCoordinate = int(anchor.YCoordinate) + dy
    return True


def _shift_mark_array(
    mark_array: object,
    mark_coverage_glyphs: List[str],
    pick: Callable[[str], bool],
    dx: int,
    dy: int,
) -> int:
    n = 0
    records = getattr(mark_array, "MarkRecord", None)
    if not records:
        return 0
    for i, gname in enumerate(mark_coverage_glyphs):
        if not pick(gname):
            continue
        if i >= len(records):
            break
        if _shift_anchor_xy(records[i].MarkAnchor, dx, dy):
            n += 1
    return n


def _shift_markbase_base_anchors(
    sub: object,
    base_pick: Callable[[str], bool],
    dx: int,
    dy: int,
) -> int:
    n = 0
    bases = sub.BaseCoverage.glyphs
    class_count = int(sub.ClassCount)
    for i, gname in enumerate(bases):
        if not base_pick(gname):
            continue
        br = sub.BaseArray.BaseRecord[i]
        anchors = getattr(br, "BaseAnchor", None) or []
        for j in range(min(class_count, len(anchors))):
            if _shift_anchor_xy(anchors[j], dx, dy):
                n += 1
    return n


def _shift_markmark_mark1(
    sub: object,
    pick: Callable[[str], bool],
    dx: int,
    dy: int,
) -> int:
    return _shift_mark_array(
        sub.Mark1Array, sub.Mark1Coverage.glyphs, pick, dx, dy
    )


def _shift_markmark_mark2(
    sub: object,
    pick: Callable[[str], bool],
    dx: int,
    dy: int,
) -> int:
    return _shift_mark_array(
        sub.Mark2Array, sub.Mark2Coverage.glyphs, pick, dx, dy
    )


def _shift_marklig_ligature_anchors(
    sub: object,
    base_pick: Callable[[str], bool],
    dx: int,
    dy: int,
) -> int:
    """עוגני רכיבים בליגטורות (למשל שין + ניקוד) — מזיזים רק רשומות ליגטורה שבסינון בסיס."""
    n = 0
    lig_cov = sub.LigatureCoverage.glyphs
    lig_arr = sub.LigatureArray
    for li, lig_name in enumerate(lig_cov):
        if not base_pick(lig_name):
            continue
        attach = lig_arr.LigatureAttach[li]
        for comp in attach.ComponentRecord:
            for anch in comp.LigatureAnchor:
                if anch is None:
                    continue
                if _shift_anchor_xy(anch, dx, dy):
                    n += 1
    return n


def run_adjust(
    font: TTFont,
    dx: int,
    dy: int,
    mark_pick: Optional[Callable[[str], bool]],
    base_pick: Optional[Callable[[str], bool]],
    do_mark_on_mark1: bool,
    do_mark_on_mark2: bool,
    do_ligature_components: bool,
) -> Tuple[int, List[str]]:
    log: List[str] = []
    total = 0
    for li, sj, sub in _iter_gpos_subtables(font):
        name = type(sub).__name__
        changed_here = 0
        if name == "MarkBasePos":
            if mark_pick is not None:
                changed_here += _shift_mark_array(
                    sub.MarkArray, sub.MarkCoverage.glyphs, mark_pick, dx, dy
                )
            if base_pick is not None:
                changed_here += _shift_markbase_base_anchors(sub, base_pick, dx, dy)
        elif name == "MarkLigPos":
            if mark_pick is not None:
                changed_here += _shift_mark_array(
                    sub.MarkArray, sub.MarkCoverage.glyphs, mark_pick, dx, dy
                )
            if do_ligature_components and base_pick is not None:
                changed_here += _shift_marklig_ligature_anchors(
                    sub, base_pick, dx, dy
                )
        elif name == "MarkMarkPos":
            if do_mark_on_mark1 and mark_pick is not None:
                changed_here += _shift_markmark_mark1(sub, mark_pick, dx, dy)
            if do_mark_on_mark2 and mark_pick is not None:
                changed_here += _shift_markmark_mark2(sub, mark_pick, dx, dy)
        if changed_here:
            total += changed_here
            log.append(f"GPOS Lookup[{li}] sub[{sj}] {name}: {changed_here} anchor(s)")
    return total, log


def cmd_list(font: TTFont, ranges: List[Tuple[int, int]], all_marks: bool) -> None:
    uni = _best_cmap_unicode_to_name(font)
    if all_marks:
        names = sorted(set(uni.values()))
        title = "כל הגליפים ב-cmap (לסינון ידני)"
    else:
        gset = _glyph_names_for_ranges(uni, ranges)
        names = sorted(gset)
        title = f"גליפי סימון בטווחים (n={len(names)})"
    print(title)
    rev: dict[str, List[int]] = {}
    for cp, gn in uni.items():
        rev.setdefault(gn, []).append(cp)
    for gn in names:
        cps = sorted(rev.get(gn, []))
        ucs = ", ".join(f"U+{c:04X}" for c in cps) if cps else "?"
        print(f"  {gn}\t{ucs}")


def main() -> None:
    p = argparse.ArgumentParser(
        description="הזזת עוגני GPOS (ניקוד) בגופן TrueType/OpenType"
    )
    p.add_argument("font", help="נתיב לקובץ .ttf / .otf")
    p.add_argument("-o", "--output", help="קובץ פלט (חובה לשינוי בפועל)")
    p.add_argument("--dx", type=int, default=0, help="הזזה אופקית ביחידות גופן")
    p.add_argument("--dy", type=int, default=0, help="הזזה אנכית ביחידות גופן")
    p.add_argument(
        "--unicode-ranges",
        type=str,
        default="",
        help="טווחי הקסדצימליים, למשל: 05C1-05C2,05B0-05BF",
    )
    p.add_argument(
        "--hebrew-marks",
        action="store_true",
        help="מסנן לסימני ניקוד/עברית נפוצים (0591–05C7, 05F0–05F4, FB1E)",
    )
    p.add_argument(
        "--glyphs",
        type=str,
        default="",
        help="רשימת שמות גליף מופרדים בפסיקים (מתעלם מטווחי unicode אם הוגדר)",
    )
    p.add_argument(
        "--shift-base-anchors",
        type=str,
        default="",
        help="הזזת BaseAnchor על אותיות בסיס (שמות גליף מופרדים בפסיקים), לא את סימן הניקוד",
    )
    p.add_argument(
        "--ligature-components",
        action="store_true",
        help="כשמזיזים בסיסים: כלול גם עוגני רכיב ב-MarkToLigature לליגטורות שנבחרו",
    )
    p.add_argument(
        "--mark-on-mark",
        action="store_true",
        help="עדכן גם MarkToMark (סימן על סימן)",
    )
    p.add_argument(
        "--mark-on-mark-both",
        action="store_true",
        help="MarkToMark: הזז גם Mark1 וגם Mark2 (ברירת מחדל: רק Mark1)",
    )
    p.add_argument(
        "--list-hebrew-marks",
        action="store_true",
        help="הדפס גליפים בטווחי hebrew-marks ויצא",
    )
    p.add_argument(
        "--list-all-cmap",
        action="store_true",
        help="הדפס את כל שמות הגליף מה-cmap (לעזרת סינון)",
    )
    args = p.parse_args()

    if not os.path.isfile(args.font):
        sys.exit(f"לא נמצא קובץ: {args.font}")

    font = TTFont(args.font)
    try:
        if args.list_hebrew_marks:
            cmd_list(font, list(HEBREW_MARK_UNICODE_RANGES), all_marks=False)
            return
        if args.list_all_cmap:
            cmd_list(font, [], all_marks=True)
            return

        if args.dx == 0 and args.dy == 0:
            sys.exit("ציינו לפחות אחד מ־--dx / --dy, או השתמשו במצב --list-hebrew-marks")

        mark_pick: Optional[Callable[[str], bool]] = None
        if args.glyphs.strip():
            gset = _parse_glyph_names(font, args.glyphs)
            mark_pick = lambda gn, s=gset: gn in s
        elif args.unicode_ranges.strip():
            ranges = _parse_ranges(args.unicode_ranges)
            uni = _best_cmap_unicode_to_name(font)
            gset = _glyph_names_for_ranges(uni, ranges)
            if not gset:
                sys.exit("אין גליפים ב-cmap שמתאימים לטווחי ה-unicode שניתנו")
            mark_pick = lambda gn, s=gset: gn in s
        elif args.hebrew_marks:
            uni = _best_cmap_unicode_to_name(font)
            gset = _glyph_names_for_ranges(uni, HEBREW_MARK_UNICODE_RANGES)
            if not gset:
                sys.exit("לא נמצאו גליפי ניקוד עברי ב-cmap")
            mark_pick = lambda gn, s=gset: gn in s

        base_pick: Optional[Callable[[str], bool]] = None
        if args.shift_base_anchors.strip():
            bset = _parse_glyph_names(font, args.shift_base_anchors)
            base_pick = lambda gn, s=bset: gn in s

        if (
            mark_pick is None
            and base_pick is None
            and not args.mark_on_mark
        ):
            sys.exit(
                "בחרו סינון לסימנים: --hebrew-marks / --unicode-ranges / --glyphs, "
                "או --shift-base-anchors לשינוי עוגן על האות, "
                "או --mark-on-mark (עם סינון סימנים)"
            )
        if mark_pick is None and args.mark_on_mark:
            sys.exit("ל־--mark-on-mark נדרש גם סינון סימנים (--hebrew-marks / --glyphs / …)")

        if not args.output:
            sys.exit("חובה -o / --output לשמירת גופן אחרי שינוי")

        do_m2_1 = bool(args.mark_on_mark)
        do_m2_2 = bool(args.mark_on_mark and args.mark_on_mark_both)

        total, log = run_adjust(
            font,
            args.dx,
            args.dy,
            mark_pick,
            base_pick,
            do_mark_on_mark1=do_m2_1,
            do_mark_on_mark2=do_m2_2,
            do_ligature_components=bool(args.ligature_components),
        )
        if not log:
            print(
                "לא עודכנו עוגנים. ייתכן שאין GPOS Mark*, או שאין התאמה לסינון.",
                file=sys.stderr,
            )
        else:
            for line in log:
                print(line)
            print(f"סה\"כ עוגנים שעודכנו: {total}")

        font.save(args.output)
        print(f"נשמר: {args.output}")
    finally:
        font.close()


if __name__ == "__main__":
    main()
