#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מחיל קובץ פרויקט JSON מהעורך האינטרנטי על גופן (TTF/OTF).

לכל כלל: אות בסיס + רשימת סימנים — מוסיף את offsetX/offsetY לעוגן ה-Mark
בזוג MarkToBase קיים (או אחרי יצירת זוג בעזרת ensure_mark_to_base_pair).

דרישות:
  pip install fonttools
  מבנה ריפו: תיקיית hebrew-mark-editor/gpos_editor_app לצד hebrew-nikkud-web-editor

דוגמה:
  python scripts/apply_nikkud_project.py --input Font.ttf --project nikkud-project.json -o Font-nikkud.ttf

הערות:
  - אם אין בגופן בכלל תת־טבלאות MarkToBase, הסקריפט ייכשל (אין יצירת GPOS מאפס).
  - offsetX/Y בפרויקט מתפרשים כ **דלתא** שמוסיפים לקואורדינטות עוגן ה-Mark הקיימות
    (לאחר ensure — עוגן ברירת מחדל 0,0 אם חדש).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _repo_root() -> Path:
    # .../hebrew-nikkud-web-editor/scripts/this.py -> parents[2] = שורש הריפו
    return Path(__file__).resolve().parents[2]


def _bootstrap_gpos_editor_path() -> Path:
    gpos_app = _repo_root() / "hebrew-mark-editor" / "gpos_editor_app"
    if not (gpos_app / "font_loader.py").is_file():
        raise SystemExit(
            f"לא נמצאה תיקיית gpos_editor_app: {gpos_app}\n"
            "הריצו את הסקריפט מתוך ריפו שמכיל גם את hebrew-mark-editor."
        )
    sys.path.insert(0, str(gpos_app))
    return gpos_app


def main() -> None:
    _bootstrap_gpos_editor_path()
    from font_loader import (  # type: ignore  # noqa: E402
        FontLoader,
        _anchor_xy,
        _set_anchor_xy,
        find_mark_base_for_pair,
    )

    ap = argparse.ArgumentParser(description="החלת פרויקט ניקוד על גופן")
    ap.add_argument("--input", "-i", required=True, help="קובץ גופן מקור")
    ap.add_argument("--project", "-p", required=True, help="nikkud-project.json")
    ap.add_argument("--output", "-o", required=True, help="קובץ גופן פלט")
    args = ap.parse_args()

    with open(args.project, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("version") != 1:
        raise SystemExit(f"גרסת פרויקט לא נתמכת: {data.get('version')}")
    rules = data.get("rules") or []
    if not rules:
        raise SystemExit("אין rules בפרויקט")

    fl = FontLoader(args.input)
    try:
        ok = skip = 0
        for ri, rule in enumerate(rules):
            bcp = int(rule.get("baseCodePoint", -1))
            bg = fl.get_glyph_name(bcp)
            if not bg:
                print(f"[כלל {ri}] אין cmap לאות U+{bcp:04X} — דילוג", file=sys.stderr)
                skip += 1
                continue
            for mj, m in enumerate(rule.get("marks") or []):
                mcp = int(m.get("codePoint", -1))
                dx = int(round(float(m.get("offsetX", 0))))
                dy = int(round(float(m.get("offsetY", 0))))
                mg = fl.get_glyph_name(mcp)
                if not mg:
                    print(
                        f"[כלל {ri} סימון {mj}] אין cmap ל-U+{mcp:04X} — דילוג",
                        file=sys.stderr,
                    )
                    skip += 1
                    continue
                if not fl.ensure_mark_to_base_pair(bg, mg):
                    print(
                        f"[כלל {ri}] לא ניתן להבטיח MarkToBase ל {bg}+{mg} "
                        "(אין GPOS MarkToBase בגופן?) — דילוג",
                        file=sys.stderr,
                    )
                    skip += 1
                    continue
                mbi = find_mark_base_for_pair(fl.font, bg, mg)
                if not mbi:
                    skip += 1
                    continue
                ma = mbi.get_mark_anchor()
                mx, my = _anchor_xy(ma)
                _set_anchor_xy(ma, mx + dx, my + dy)
                ok += 1
        fl.save(args.output)
    finally:
        fl.close()

    print(f"נשמר: {args.output}")
    print(f"עודכנו זוגות MarkToBase (סימנים): {ok}, דולגו: {skip}")


if __name__ == "__main__":
    main()
