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
import time
from pathlib import Path
from typing import List, Tuple

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _stage(msg: str) -> None:
    """stdout — מועבר לחלון השרת בזמן אמת בייצוא היברידי (Tee)."""
    print(f"[hybrid] {time.strftime('%H:%M:%S')} {msg}", flush=True)


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
    eng_hmtx = engine["hmtx"]
    leg_hmtx = legacy["hmtx"]

    # Guardrail: אם רוחבי אות "נופלים" לאפס, אינדיזיין מציג overlap מלא.
    # בחר סף מינימלי סביר ביחידות פונט של ה-Engine.
    min_aw = max(50, int(round(upe_e * 0.05)))  # ~50 ל-1000upm

    def _scaled_aw_lsb(lg_name: str, eg_name: str) -> tuple[int, int]:
        try:
            aw, lsb = leg_hmtx[lg_name]
        except Exception:
            # fallback: שמור רוחב מה-Engine אם חסר ב-Legacy
            return eng_hmtx[eg_name]
        aw_s = int(round(float(aw) * factor))
        lsb_s = int(round(float(lsb) * factor))
        if aw_s < min_aw:
            # אל תהרוס רוחב תקין של Engine.
            eaw, elsb = eng_hmtx[eg_name]
            warnings.append(
                f"U+{cp:04X} aw קטן מדי אחרי סקייל ({aw_s}); שומר רוחב Engine ({eaw})"
            )
            return int(eaw), int(elsb)
        return aw_s, lsb_s

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

            engine["hmtx"][eg] = _scaled_aw_lsb(lg, eg)
        except Exception as e:
            warnings.append(f"U+{cp:04X} hmtx/scale: {e}")

    return warnings


def _ensure_anchor(x: float, y: float) -> otTables.Anchor:
    a = otTables.Anchor()
    a.Format = 1
    a.XCoordinate = int(round(x))
    a.YCoordinate = int(round(y))
    return a


def _unwrap_gpos_subtable(st):
    while type(st).__name__ == "ExtensionPos":
        st = st.ExtSubTable
    return st


def _sort_markbasepos_coverage_arrays(st, glyph_to_id: dict[str, int]) -> None:
    """
    אינדיזיין/מנועים מסוימים רגישים ל-Coverage לא ממוין לפי glyphID.
    ממיין BaseCoverage+BaseArray, וגם MarkCoverage+MarkArray, תוך שמירת התאמה.
    """
    try:
        bases = list(st.BaseCoverage.glyphs)
        marks = list(st.MarkCoverage.glyphs)
    except Exception:
        return

    if getattr(st, "BaseArray", None) and getattr(st.BaseArray, "BaseRecord", None):
        base_records = list(st.BaseArray.BaseRecord)
        if len(base_records) == len(bases):
            base_perm = sorted(
                range(len(bases)),
                key=lambda i: glyph_to_id.get(bases[i], 1_000_000_000),
            )
            st.BaseCoverage.glyphs = [bases[i] for i in base_perm]
            st.BaseArray.BaseRecord = [base_records[i] for i in base_perm]

    if getattr(st, "MarkArray", None) and getattr(st.MarkArray, "MarkRecord", None):
        mark_records = list(st.MarkArray.MarkRecord)
        if len(mark_records) == len(marks):
            mark_perm = sorted(
                range(len(marks)),
                key=lambda i: glyph_to_id.get(marks[i], 1_000_000_000),
            )
            st.MarkCoverage.glyphs = [marks[i] for i in mark_perm]
            st.MarkArray.MarkRecord = [mark_records[i] for i in mark_perm]


def _auto_base_anchor_for_mark_cp(
    mark_cp: int,
    *,
    x_min: float,
    x_max: float,
    y_min: float,
    y_max: float,
    margin_below: float,
    margin_above: float,
) -> tuple[float, float]:
    """
    כלל אוטומטי ל-BaseAnchor עבור אות+ניקוד, לפי Bounding Box של האות (ביחידות פונט).
    מחזיר (x,y) של BaseAnchor.
    """
    cx = (x_min + x_max) / 2.0
    w = max(1.0, x_max - x_min)
    cy = (y_min + y_max) / 2.0

    # קבוצה א׳: ניקוד תחתון
    if mark_cp in {
        0x05B0,  # שווא
        0x05B1,  # חטף־סגול
        0x05B2,  # חטף־פתח
        0x05B3,  # חטף־קמץ
        0x05B4,  # חיריק
        0x05B5,  # צרי
        0x05B6,  # סגול
        0x05B7,  # פתח
        0x05B8,  # קמץ
        0x05BB,  # קובוץ
        0x05C7,  # קמץ קטן
    }:
        return cx, y_min - margin_below

    # קבוצה ג׳: פנימי (דגש/מפיק)
    if mark_cp in {0x05BC}:  # דגש / מפיק
        return cx, cy

    # קבוצה ב׳: עליון
    if mark_cp in {0x05B9, 0x05BA}:  # חולם / חולם חסר לוו
        return cx + (w * 0.22), y_max + margin_above
    if mark_cp == 0x05C1:  # נקודת שין (ימין)
        return x_max - (w * 0.18), y_max + margin_above
    if mark_cp == 0x05C2:  # נקודת סין (שמאל)
        return x_min + (w * 0.18), y_max + margin_above
    if mark_cp in {0x05BF}:  # רפה
        return cx, y_max + margin_above

    # ברירת מחדל: כמו ניקוד תחתון (בטוח יותר מטעם לא מוכר)
    return cx, y_min - margin_below


def auto_center_mark_to_base_anchors_for_merged_hebrew_letters(engine: TTFont) -> int:
    """
    לאחר מיזוג אותיות Legacy לתוך Engine, מחשב BaseAnchor אוטומטי לפי BBox של האות הממוזגת.

    BaseAnchor הוא פר-אות ופר-מחלקת סימון. שינוי MarkAnchor היה מזיז את אותו ניקוד
    על כל האותיות בבת אחת — ולכן אנחנו *לא* נוגעים ב-MarkAnchor.
    """
    if "GPOS" not in engine or "glyf" not in engine:
        return 0
    gpos = engine["GPOS"].table
    if not getattr(gpos, "LookupList", None) or not gpos.LookupList.Lookup:
        return 0

    eng_cmap = engine.getBestCmap() or {}
    # glyph -> cp (לניקוד/טעמים בטווח)
    mark_glyph_to_cp: dict[str, int] = {}
    for cp, gn in eng_cmap.items():
        if not isinstance(cp, int) or not isinstance(gn, str):
            continue
        if 0x0591 <= cp <= 0x05C7 and gn not in mark_glyph_to_cp:
            mark_glyph_to_cp[gn] = cp

    glyf = engine["glyf"]
    glyph_to_id = {g: i for i, g in enumerate(engine.getGlyphOrder() or [])}
    upem = float(engine["head"].unitsPerEm) if "head" in engine else 1000.0
    margin_below = max(20.0, round(upem * 0.04))  # ~40 ל-1000upm
    margin_above = max(30.0, round(upem * 0.06))  # ~60 ל-1000upm

    changed = 0
    for lookup in gpos.LookupList.Lookup:
        for raw in lookup.SubTable:
            st = _unwrap_gpos_subtable(raw)
            if type(st).__name__ != "MarkBasePos" or getattr(st, "Format", None) != 1:
                continue
            try:
                bases = st.BaseCoverage.glyphs
                marks = st.MarkCoverage.glyphs
            except Exception:
                continue
            if not bases or not marks:
                continue

            for cp in range(0x05D0, 0x05EA + 1):
                bg = eng_cmap.get(cp)
                if not bg or bg not in bases or bg not in glyf.glyphs:
                    continue
                bgi = bases.index(bg)
                g = glyf[bg]
                try:
                    g.recalcBounds(glyf)
                except Exception:
                    pass
                x_min = float(getattr(g, "xMin", 0))
                x_max = float(getattr(g, "xMax", 0))
                y_min = float(getattr(g, "yMin", 0))
                y_max = float(getattr(g, "yMax", 0))

                br = st.BaseArray.BaseRecord[bgi]
                for mi, mg in enumerate(marks):
                    mcp = mark_glyph_to_cp.get(mg)
                    if mcp is None:
                        continue
                    mrec = st.MarkArray.MarkRecord[mi]
                    cls = int(getattr(mrec, "Class", -1))
                    if cls < 0 or cls >= int(st.ClassCount):
                        continue

                    nx, ny = _auto_base_anchor_for_mark_cp(
                        mcp,
                        x_min=x_min,
                        x_max=x_max,
                        y_min=y_min,
                        y_max=y_max,
                        margin_below=margin_below,
                        margin_above=margin_above,
                    )
                    while len(br.BaseAnchor) <= cls:
                        br.BaseAnchor.append(None)
                    br.BaseAnchor[cls] = _ensure_anchor(nx, ny)
                    changed += 1

            # אחרי שינויים — ודא Coverages ממוין כדי להימנע מבעיות מנועי טקסט.
            _sort_markbasepos_coverage_arrays(st, glyph_to_id)
    return changed


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

    _stage("טוען Legacy + Engine לזיכרון")
    legacy = TTFont(args.legacy)
    engine = TTFont(args.engine)
    try:
        if "GPOS" not in engine:
            print(
                "אזהרה: לפונט ה־Engine אין GPOS — apply_nikkud עלול לא לעשות כלום או להיכשל.",
                file=sys.stderr,
            )
        _stage("ממזג מתארי אותיות עבריות (U+05D0…U+05EA)…")
        warns = merge_hebrew_letter_outlines(legacy, engine)
        for w in warns:
            print(w, file=sys.stderr)
        _stage("מיזוג אותיות הסתיים (" + str(len(warns)) + " שורות אזהרה/מידע)")
        _stage("מחשב עוגני BaseAnchor אוטומטיים לפי BBox של האותיות הממוזגות…")
        try:
            n_changed = auto_center_mark_to_base_anchors_for_merged_hebrew_letters(engine)
            _stage("עודכנו/נוצרו BaseAnchors: " + str(n_changed))
        except Exception as e:
            print(f"[hybrid] auto anchors: failed: {e!r}", file=sys.stderr)
    finally:
        legacy.close()

    out_path = Path(args.output)
    merged_path = out_path.with_name(out_path.stem + "-merged.tmp" + out_path.suffix)
    _stage(
        "שומר גופן זמני אחרי מיזוג (שלב כבד — דקות אפשריות בפונט Engine גדול כמו Frank Ruhl)…"
    )
    t0 = time.time()
    engine.save(str(merged_path))
    engine.close()
    _stage("שמירת המיזוג הסתיימה (" + str(round(time.time() - t0, 1)) + " שניות)")

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
    apply_log = out_path.parent / (out_path.stem + "-apply.log")
    timed_out = False
    proc_rc = 0
    _stage("מריץ apply_nikkud_project (שמירת GPOS — עלול לקחת דקות ארוכות)…")
    with open(apply_log, "wb") as logf:
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(_repo_root()),
                stdout=logf,
                stderr=sys.stderr,
                timeout=1200,
            )
            proc_rc = proc.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
            proc_rc = -1

    try:
        tail = (
            apply_log.read_text(encoding="utf-8", errors="replace")[-12000:]
            if apply_log.is_file()
            else ""
        )
        if timed_out:
            raise SystemExit("apply_nikkud_project: פג זמן (20 דקות).\n" + tail)
        if proc_rc != 0:
            raise SystemExit(tail.strip() or "apply_nikkud_project נכשל")
    finally:
        merged_path.unlink(missing_ok=True)
        apply_log.unlink(missing_ok=True)

    _stage("apply_nikkud_project הסתיים")
    if (args.export_font_name or "").strip():
        _stage("מעדכן טבלת שמות לפי שם הייצוא")
        final = TTFont(str(out_path))
        try:
            apply_export_font_name(final, args.export_font_name)
            final.save(str(out_path))
        finally:
            final.close()

    _stage("סיום: " + str(out_path.resolve()))


if __name__ == "__main__":
    main()
