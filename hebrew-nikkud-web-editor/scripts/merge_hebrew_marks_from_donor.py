#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מעתיק גליפי ניקוד (ומש אופציונלי טעמים) מפונט תורם לפונט יעד — למשל ניקוד Assistant לגופן עברי אחר.

העתקה: מתארים (glyf), רוחב (hmtx), ומיפוי cmap — לפי glyph_importer.import_niqqud / import_taamim.
לא מעתיקים את כל טבלת GPOS מהתורם (שמות אותיות ביעד שונים בדרך כלל).

אחרי המיזוג:
  - אם ליעד כבר יש MarkToBase ב-GPOS — אפשר לכוון בעורך האינטרנטי ולהריץ apply_nikkud_project.py.
  - אם אין MarkToBase ביעד — צריך להוסיף בכלי פונטים או להתחיל מפונט בסיס שכבר תומך בניקוד.

דוגמה:
  python scripts/merge_hebrew_marks_from_donor.py ^
    --donor "C:\\...\\Assistant-Regular.ttf" ^
    --input MyHebrew.ttf ^
    -o MyHebrew-with-donor-marks.ttf

דרישות: pip install fonttools, מבנה ריפו עם hebrew-mark-editor/gpos_editor_app.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _bootstrap_gpos_editor_path() -> Path:
    gpos_app = _repo_root() / "hebrew-mark-editor" / "gpos_editor_app"
    if not (gpos_app / "glyph_importer.py").is_file():
        raise SystemExit(
            f"לא נמצאה תיקיית gpos_editor_app: {gpos_app}\n"
            "הריצו מתוך ריפו שמכיל גם את hebrew-mark-editor."
        )
    sys.path.insert(0, str(gpos_app))
    return gpos_app


def main() -> None:
    _bootstrap_gpos_editor_path()
    from fontTools.ttLib import TTFont  # noqa: E402

    from font_loader import iter_mark_base_subtables  # noqa: E402
    from glyph_importer import (  # noqa: E402
        import_niqqud,
        import_taamim,
        upem_pair_message,
    )

    ap = argparse.ArgumentParser(
        description="ייבוא ניקוד (וטעמים) מפונט תורם לפונט יעד"
    )
    ap.add_argument(
        "--donor",
        "-d",
        required=True,
        help="פונט תורם (למשל Assistant) עם גליפי ניקוד",
    )
    ap.add_argument(
        "--input",
        "-i",
        required=True,
        help="פונט יעד (יישמר עותק מעודכן לנתיב הפלט)",
    )
    ap.add_argument("--output", "-o", required=True, help="קובץ TTF/OTF פלט")
    ap.add_argument(
        "--taamim",
        action="store_true",
        help="גם לייבא טעמים (U+0591..U+05AF) אם קיימים בתורם",
    )
    args = ap.parse_args()

    donor = TTFont(args.donor)
    target = TTFont(args.input)

    print(upem_pair_message(donor, target))

    ok_n, errs_n = import_niqqud(donor, target)
    print(f"ניקוד: יובאו {ok_n} גליפים.")
    for line in errs_n:
        print(line, file=sys.stderr)

    if args.taamim:
        ok_t, errs_t = import_taamim(donor, target)
        print(f"טעמים: יובאו {ok_t} גליפים.")
        for line in errs_t:
            print(line, file=sys.stderr)

    msubs = list(iter_mark_base_subtables(target))
    if not msubs:
        print(
            "אזהרה: בגופן היעד אין תת־טבלאות MarkToBase ב-GPOS. "
            "apply_nikkud_project.py לא יוכל לעדכן מיקום עד שיופיע MarkToBase "
            "(למשל מפונט עברי בסיס או הוספה ב-FontForge / Glyphs).",
            file=sys.stderr,
        )
    else:
        print(f"GPOS: נמצאו {len(msubs)} תתי־טבלאות MarkToBase — ניתן לכוון בעורך ולהחיל JSON.")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    target.save(str(out))
    print(f"נשמר: {out.resolve()}")


if __name__ == "__main__":
    main()
