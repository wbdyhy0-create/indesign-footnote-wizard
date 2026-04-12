#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מיזוג היברידי: מתארי אותיות עבריות (U+05D0..U+05EA) מפונט Legacy לתוך פונט Engine,
שומר על טבלאות ה־OpenType של ה־Engine (כולל GPOS), ואז מחיל פרויקט ניקוד JSON.

דרישות:
  pip install fonttools
  מבנה ריפו עם hebrew-mark-editor/gpos_editor_app (כמו apply_nikkud_project.py)

דוגמה:
  python scripts/hybrid_gpos_export.py --legacy AGAS.ttf --engine FrankRuhlLibre-Regular.ttf \\
    --project nikkud-project.json -o AGAS-with-frank-engine.ttf
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _require_glyf(tt: TTFont, label: str) -> None:
    if "glyf" not in tt or tt["glyf"] is None:
        raise SystemExit(
            f"{label}: נדרש פונט עם טבלת glyf (TrueType). "
            "פונט CFF בלבד (OTF ללא glyf) לא נתמך במיזוג זה."
        )


def _scale_simple_glyph(font: TTFont, gname: str, factor: float) -> None:
    glyf = font["glyf"]
    g = glyf[gname]
    if g.isComposite():
        return
    coords, _end, _flags = g.getCoordinates(glyf)
    if coords is None or len(coords) == 0:
        return
    new_pts = [
        (int(round(x * factor)), int(round(y * factor))) for x, y in list(coords)
    ]
    g.setCoordinates(new_pts, glyf)
    try:
        g.recalcBounds(glyf)
    except Exception:
        pass


def _copy_simple_glyph_outline(
    legacy: TTFont, lg: str, engine: TTFont, eg: str
) -> Tuple[bool, str]:
    """
    מעתיק מתאר מ־legacy ל־engine דרך TTGlyphPen (בטוח יותר מ־deepcopy בין פונטים).
    """
    leg_glyf = legacy["glyf"]
    eng_glyf = engine["glyf"]
    sg = leg_glyf[lg]
    if sg.isComposite():
        return False, "legacy composite"
    try:
        pen = TTGlyphPen(eng_glyf)
        sg.draw(pen, leg_glyf)
        eng_glyf[eg] = pen.glyph()
    except Exception as e:
        return False, str(e)
    return True, ""


def merge_hebrew_letter_outlines(legacy: TTFont, engine: TTFont) -> List[str]:
    """
    מחליף את מתארי glyf (וה־hmtx) של אותיות U+05D0..U+05EA ב־engine
    בגרסה מ־legacy, עם סקייל ל־unitsPerEm של ה־engine.
    """
    warnings: List[str] = []
    _require_glyf(legacy, "Legacy")
    _require_glyf(engine, "Engine")

    upe_l = int(legacy["head"].unitsPerEm)
    upe_e = int(engine["head"].unitsPerEm)
    factor = upe_e / float(upe_l)

    leg_cmap = legacy.getBestCmap() or {}
    eng_cmap = engine.getBestCmap() or {}
    leg_glyf = legacy["glyf"]
    eng_glyf = engine["glyf"]

    for cp in range(0x05D0, 0x05EA + 1):
        lg = leg_cmap.get(cp)
        eg = eng_cmap.get(cp)
        if not lg:
            warnings.append(f"legacy: אין cmap ל־U+{cp:04X}")
            continue
        if not eg:
            warnings.append(f"engine: אין cmap ל־U+{cp:04X}")
            continue
        if lg not in leg_glyf.glyphs:
            warnings.append(f"legacy: אין glyf ל־{lg}")
            continue
        if eg not in eng_glyf.glyphs:
            warnings.append(f"engine: אין glyf ל־{eg}")
            continue

        sg = leg_glyf[lg]
        if sg.isComposite():
            warnings.append(f"U+{cp:04X}: legacy {lg} מרוכב — דילוג")
            continue

        ok, err = _copy_simple_glyph_outline(legacy, lg, engine, eg)
        if not ok:
            warnings.append(f"U+{cp:04X} {lg}->{eg}: {err}")
            continue

        try:
            if abs(factor - 1.0) > 1e-9:
                _scale_simple_glyph(engine, eg, factor)

            aw, lsb = legacy["hmtx"][lg]
            engine["hmtx"][eg] = (int(round(aw * factor)), int(round(lsb * factor)))
        except Exception as e:
            warnings.append(f"U+{cp:04X} hmtx/scale: {e}")

    return warnings


def _sanitize_postscript_name(s: str) -> str:
    """
    שם PostScript (name ID 6): ASCII בלבד, עד 63 בתים, ללא רווחים.
    """
    t = (s or "").strip().replace(" ", "-")
    t = re.sub(r"[^A-Za-z0-9._-]", "", t)
    if not t:
        t = "NikkudHybridExport"
    return t[:63]


def apply_export_font_name(font: TTFont, export_name: str) -> None:
    """
    מעדכן טבלת name כדי שהפונט יופיע כמשפחה נפרדת (למשל באינדיזיין).
    מעדכן לפחות: 1 (משפחה), 4 (שם מלא), 6 (PostScript), 3 (מזהה ייחודי).
    אם קיימים 16+17 — מעדכן גם 16 כדי שלא יישאר שם טיפוגרפי ישן.
    """
    raw = (export_name or "").strip()
    if not raw:
        return
    ps = _sanitize_postscript_name(raw)
    name = font["name"]
    had_typo_family = any(nr.nameID == 16 for nr in name.names)
    has_typo_sub = any(nr.nameID == 17 for nr in name.names)
    name.names = [nr for nr in name.names if nr.nameID not in (1, 3, 4, 6, 16)]
    # Windows BMP Unicode (עברית בשם תצוגה — בסדר)
    name.setName(raw, 1, 3, 1, 0x409)
    name.setName(raw, 4, 3, 1, 0x409)
    name.setName(ps, 6, 3, 1, 0x409)
    name.setName(ps, 6, 1, 0, 0)
    rev = float(font["head"].fontRevision) if "head" in font else 1.0
    unique = f"{rev};NIKKUD-HYBRID;{ps}"
    name.setName(unique, 3, 3, 1, 0x409)
    if had_typo_family and has_typo_sub:
        name.setName(raw, 16, 3, 1, 0x409)
    if all(ord(c) < 128 for c in raw):
        try:
            name.setName(raw, 1, 1, 0, 0)
            name.setName(raw, 4, 1, 0, 0)
        except Exception:
            pass


def main() -> None:
    ap = argparse.ArgumentParser(description="מיזוג אותיות legacy לתוך engine + החלת JSON ניקוד")
    ap.add_argument("--legacy", "-l", required=True, help="פונט אותיות (למשל Agas)")
    ap.add_argument("--engine", "-e", required=True, help="פונט מנוע GPOS (למשל Frank Ruhl Libre)")
    ap.add_argument("--project", "-p", required=True, help="nikkud-project.json")
    ap.add_argument("--output", "-o", required=True, help="פלט TTF/OTF")
    ap.add_argument(
        "--export-font-name",
        default="",
        help="שם משפחה/תצוגה לפלט (טבלת name). ריק = ללא שינוי.",
    )
    args = ap.parse_args()

    apply_script = (
        _repo_root() / "hebrew-nikkud-web-editor" / "scripts" / "apply_nikkud_project.py"
    )
    if not apply_script.is_file():
        raise SystemExit(f"לא נמצא {apply_script}")

    legacy = TTFont(args.legacy)
    engine = TTFont(args.engine)
    try:
        if "GPOS" not in engine:
            print(
                "אזהרה: לפונט ה־Engine אין GPOS — apply_nikkud עלול לא לעשות כלום או להיכשל.",
                file=sys.stderr,
            )
        warns = merge_hebrew_letter_outlines(legacy, engine)
        for w in warns:
            print(w, file=sys.stderr)
    finally:
        legacy.close()

    out_path = Path(args.output)
    merged_path = out_path.with_name(out_path.stem + "-merged.tmp" + out_path.suffix)
    engine.save(str(merged_path))
    engine.close()

    cmd = [
        sys.executable,
        str(apply_script),
        "-i",
        str(merged_path.resolve()),
        "-p",
        str(Path(args.project).resolve()),
        "-o",
        str(out_path.resolve()),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(_repo_root()))
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "").strip()
            raise SystemExit(err or "apply_nikkud_project נכשל")
    finally:
        merged_path.unlink(missing_ok=True)

    if (args.export_font_name or "").strip():
        final = TTFont(str(out_path))
        try:
            apply_export_font_name(final, args.export_font_name)
            final.save(str(out_path))
        finally:
            final.close()

    print(f"נשמר: {out_path.resolve()}")


if __name__ == "__main__":
    main()
