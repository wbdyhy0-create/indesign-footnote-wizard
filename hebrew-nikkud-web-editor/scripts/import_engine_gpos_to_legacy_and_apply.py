#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מצב "אוניברסלי":
1) Legacy נשאר בסיס (צורות/metrics לא משתנים).
2) מייבא GPOS (+GDEF כשאפשר) מפונט Engine לתוך Legacy, עם:
   - התאמת שמות גליפים לפי cmap (engine glyph -> codepoint -> legacy glyph)
   - סקייל קואורדינטות עוגנים לפי יחס UPEM (legacy/engine)
   - מיון Coverage לפי glyphID (ידידותי לאינדיזיין)
3) מחיל JSON (offsets) על Legacy באמצעות apply_nikkud_project.py.

דרישות:
  pip install fonttools
  מבנה ריפו עם hebrew-mark-editor/gpos_editor_app לצד hebrew-nikkud-web-editor
"""

from __future__ import annotations

import argparse
import copy
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _stage(msg: str) -> None:
    print(f"[import] {time.strftime('%H:%M:%S')} {msg}", flush=True)


def _require_glyf(tt: TTFont, label: str) -> None:
    if "glyf" not in tt or tt["glyf"] is None:
        raise SystemExit(
            f"{label}: נדרש פונט עם טבלת glyf (TrueType). "
            "פונט CFF בלבד (OTF ללא glyf) לא נתמך במצב זה."
        )


def _unwrap_gpos_subtable(st: Any) -> Any:
    while type(st).__name__ == "ExtensionPos":
        st = st.ExtSubTable
    return st


def _scale_anchor(a: Any, factor: float) -> None:
    if a is None:
        return
    fmt = getattr(a, "Format", 1)
    if fmt in (1, 2, 3):
        a.Format = 1
        a.XCoordinate = int(round(float(a.XCoordinate) * factor))
        a.YCoordinate = int(round(float(a.YCoordinate) * factor))
        # remove device tables if present
        for attr in ("XDeviceTable", "YDeviceTable", "xDeviceTable", "yDeviceTable"):
            if hasattr(a, attr):
                setattr(a, attr, None)


def _copy_glyph_outline_scaled(
    *,
    src: TTFont,
    src_name: str,
    dst: TTFont,
    dst_name: str,
    factor: float,
) -> None:
    """מעתיק glyph glyf (פשוט) + hmtx, עם סקייל לפי factor."""
    sg = src["glyf"][src_name]
    if sg.isComposite():
        # לא נוגע במרוכבים כאן; לרוב ניקוד/טעמים פשוטים.
        return
    pen0 = TTGlyphPen(dst["glyf"])
    pen = TransformPen(pen0, (factor, 0, 0, factor, 0, 0)) if abs(factor - 1.0) > 1e-9 else pen0
    sg.draw(pen, src["glyf"])
    dst["glyf"][dst_name] = pen0.glyph()
    try:
        aw, lsb = src["hmtx"][src_name]
        dst["hmtx"][dst_name] = (int(round(float(aw) * factor)), int(round(float(lsb) * factor)))
    except Exception:
        pass


def _ensure_cmap_subtable(font: TTFont, platform_id: int, enc_id: int) -> Any:
    cmap_table = font["cmap"]
    for st in cmap_table.tables:
        if st.platformID == platform_id and st.platEncID == enc_id:
            return st
    # Create a new Unicode BMP subtable (format 4)
    st = CmapSubtable.newSubtable(4)
    st.platformID = platform_id
    st.platEncID = enc_id
    st.language = 0
    st.cmap = {}
    cmap_table.tables.append(st)
    return st


def _ensure_windows_unicode_cmaps(font: TTFont) -> None:
    """
    ודא שקיימות מפות cmap סטנדרטיות:
    - (3,1) Windows Unicode BMP (format 4) — מה שאינדיזיין/וינדוס מצפים אליו לרוב
    - (3,0) Windows Symbol/Unicode (יש פונטים שמגיעים עם זה בלבד)
    - (0,3) Unicode
    """
    if "cmap" not in font:
        return
    _ensure_cmap_subtable(font, 3, 1)
    _ensure_cmap_subtable(font, 3, 0)
    _ensure_cmap_subtable(font, 0, 3)
    # Windows expects the Unicode (3,1) cmap to contain the main mappings.
    # Some legacy fonts ship mostly in (3,0); copy/sync mappings so installers don't reject.
    union: Dict[int, str] = {}
    for st in font["cmap"].tables:
        if getattr(st, "format", None) != 4:
            continue
        for cp, g in (st.cmap or {}).items():
            try:
                icp = int(cp)
            except Exception:
                continue
            if 0 <= icp <= 0xFFFF:
                union[icp] = g
    if union:
        for st in font["cmap"].tables:
            if getattr(st, "format", None) != 4:
                continue
            if (st.platformID, st.platEncID) in ((3, 1), (0, 3)):
                st.cmap = dict(union)


def _add_cmap_mapping(font: TTFont, cp: int, glyph_name: str) -> None:
    """מוסיף מיפוי cp->glyph לכל תתי-הטבלאות הרלוונטיות (BMP)."""
    if "cmap" not in font:
        return
    _ensure_windows_unicode_cmaps(font)
    for st in font["cmap"].tables:
        if st.format != 4:
            continue
        if cp > 0xFFFF:
            continue
        if (st.platformID, st.platEncID) in ((3, 1), (3, 0), (0, 3)):
            st.cmap[int(cp)] = glyph_name


def _sanitize_postscript_name(s: str) -> str:
    """שם PostScript (name ID 6): ASCII בלבד, עד 63 בתים, ללא רווחים."""
    t = (s or "").strip().replace(" ", "-")
    t = re.sub(r"[^A-Za-z0-9._-]", "", t)
    if not t:
        t = "NikkudLegacyBase"
    return t[:63]


def apply_export_font_name(font: TTFont, export_name: str) -> None:
    """עדכון name IDs כדי למנוע cache באינדיזיין/וינדוס."""
    raw = (export_name or "").strip()
    if not raw or "name" not in font:
        return
    ps = _sanitize_postscript_name(raw)
    name = font["name"]
    # Rebuild from scratch to avoid malformed/garbled name records in source fonts
    # causing Windows to reject the exported font.
    had_typo_family = any(nr.nameID == 16 for nr in name.names)
    has_typo_sub = any(nr.nameID == 17 for nr in name.names)
    name.names = []
    name.setName(raw, 1, 3, 1, 0x409)
    name.setName("Regular", 2, 3, 1, 0x409)
    name.setName(raw, 4, 3, 1, 0x409)
    name.setName(ps, 6, 3, 1, 0x409)
    name.setName(ps, 6, 1, 0, 0)
    rev = float(font["head"].fontRevision) if "head" in font else 1.0
    unique = f"{rev};NIKKUD-LEGACY-BASE;{ps}"
    name.setName(unique, 3, 3, 1, 0x409)
    if had_typo_family and has_typo_sub:
        name.setName(raw, 16, 3, 1, 0x409)
    if all(ord(c) < 128 for c in raw):
        try:
            name.setName(raw, 1, 1, 0, 0)
            name.setName("Regular", 2, 1, 0, 0)
            name.setName(raw, 4, 1, 0, 0)
        except Exception:
            pass


def _sanitize_os2_for_windows_install(font: TTFont) -> None:
    """
    נרמול שדות OS/2 נפוצים שיכולים לגרום ל-Windows "לא גופן חוקי".
    במיוחד בפונטים ישנים/מותאמים שבהם ערכים יוצאים מחוץ לטווח.
    """
    if "OS/2" not in font:
        return
    os2 = font["OS/2"]
    # Some Windows installers reject weird embedding permission bitmasks.
    # 0 = Installable embedding (safest for local fonts you generate).
    try:
        os2.fsType = 0
    except Exception:
        pass
    try:
        w = int(getattr(os2, "usWeightClass", 400))
    except Exception:
        w = 400
    if w < 100 or w > 900:
        os2.usWeightClass = 400
    try:
        ww = int(getattr(os2, "usWidthClass", 5))
    except Exception:
        ww = 5
    if ww < 1 or ww > 9:
        os2.usWidthClass = 5
    try:
        sel = int(getattr(os2, "fsSelection", 0))
    except Exception:
        sel = 0
    # For OS/2 table versions < 4, only bits 0..6 are defined.
    # Clear any higher bits that can confuse validators/installers.
    ver = int(getattr(os2, "version", 0) or 0)
    sel &= 0x007F if ver < 4 else 0x03FF
    # Ensure "REGULAR" bit when not bold/italic.
    if (sel & 0x0020) == 0 and (sel & 0x0001) == 0:
        sel |= 0x0040
    os2.fsSelection = sel


def _ensure_marks_present(
    *,
    legacy: TTFont,
    engine: TTFont,
    cps: List[int],
) -> None:
    """
    ודא שכל תווי הניקוד/טעמים קיימים ב-Legacy (cmap+glyf).
    אם חסר — נעתיק מה-Engine (שם הם קיימים לרוב).
    """
    _ensure_windows_unicode_cmaps(legacy)
    leg_cmap = legacy.getBestCmap() or {}
    eng_cmap = engine.getBestCmap() or {}
    factor = float(legacy["head"].unitsPerEm) / float(engine["head"].unitsPerEm)
    glyf_leg = legacy["glyf"]

    for cp in cps:
        eg = eng_cmap.get(cp)
        if not eg:
            continue
        lg = leg_cmap.get(cp)
        if lg and lg in glyf_leg.glyphs:
            continue
        # create a legacy glyph name if missing
        if not lg:
            lg = f"uni{cp:04X}"
            _add_cmap_mapping(legacy, cp, lg)
        if lg not in glyf_leg.glyphs:
            # חייב להיות אובייקט Glyph אמיתי, לא None (אחרת save נופל ב-compile)
            legacy["glyf"].glyphs[lg] = Glyph()
            go = list(legacy.getGlyphOrder())
            if lg not in go:
                legacy.setGlyphOrder(go + [lg])
            # set empty hmtx default; will be overwritten
            legacy["hmtx"][lg] = (0, 0)
        try:
            _copy_glyph_outline_scaled(src=engine, src_name=eg, dst=legacy, dst_name=lg, factor=factor)
        except Exception:
            continue


def _build_engine_glyph_to_cp(engine: TTFont) -> Dict[str, int]:
    m: Dict[str, int] = {}
    cmap = engine.getBestCmap() or {}
    for cp, gn in cmap.items():
        if isinstance(cp, int) and isinstance(gn, str) and gn not in m:
            m[gn] = cp
    return m


def _legacy_glyph_for_cp(legacy: TTFont, cp: int) -> Optional[str]:
    cmap = legacy.getBestCmap() or {}
    gn = cmap.get(cp)
    return gn if isinstance(gn, str) else None


def _sort_coverage_and_parallel(arr_glyphs: List[str], parallel: List[Any], glyph_to_id: Dict[str, int]) -> Tuple[List[str], List[Any]]:
    perm = sorted(range(len(arr_glyphs)), key=lambda i: glyph_to_id.get(arr_glyphs[i], 1_000_000_000))
    return [arr_glyphs[i] for i in perm], [parallel[i] for i in perm]


def _remap_and_scale_gpos(engine_gpos: Any, *, engine: TTFont, legacy: TTFont) -> Any:
    """יוצר עותק GPOS מה-Engine עם שמות גליפים של Legacy + סקייל עוגנים."""
    gpos = copy.deepcopy(engine_gpos)
    factor = float(legacy["head"].unitsPerEm) / float(engine["head"].unitsPerEm)
    eng_g2cp = _build_engine_glyph_to_cp(engine)
    glyph_to_id = {g: i for i, g in enumerate(legacy.getGlyphOrder() or [])}

    if not getattr(gpos, "LookupList", None) or not gpos.LookupList.Lookup:
        return gpos

    for lookup in gpos.LookupList.Lookup:
        # Keep only mark positioning subtables; drop everything else (kerning/ligatures/etc)
        # because Legacy may not have those glyphs and saving will fail (KeyError).
        kept_subtables: List[Any] = []
        for raw in list(lookup.SubTable):
            st = _unwrap_gpos_subtable(raw)
            st_name = type(st).__name__
            if st_name not in ("MarkBasePos", "MarkMarkPos"):
                continue

            if type(st).__name__ == "MarkBasePos" and getattr(st, "Format", None) == 1:
                bases = list(getattr(st.BaseCoverage, "glyphs", []) or [])
                marks = list(getattr(st.MarkCoverage, "glyphs", []) or [])
                base_records = list(getattr(getattr(st, "BaseArray", None), "BaseRecord", []) or [])
                mark_records = list(getattr(getattr(st, "MarkArray", None), "MarkRecord", []) or [])

                # Remap marks
                new_marks: List[str] = []
                new_mark_records: List[Any] = []
                for mg, mr in zip(marks, mark_records):
                    cp = eng_g2cp.get(mg)
                    if cp is None:
                        continue
                    lg = _legacy_glyph_for_cp(legacy, cp)
                    if not lg:
                        continue
                    new_marks.append(lg)
                    _scale_anchor(getattr(mr, "MarkAnchor", None), factor)
                    new_mark_records.append(mr)
                marks, mark_records = new_marks, new_mark_records

                # Remap bases
                new_bases: List[str] = []
                new_base_records: List[Any] = []
                for bg, br in zip(bases, base_records):
                    cp = eng_g2cp.get(bg)
                    if cp is None:
                        continue
                    lg = _legacy_glyph_for_cp(legacy, cp)
                    if not lg:
                        continue
                    # scale all anchors in this BaseRecord
                    for a in getattr(br, "BaseAnchor", []) or []:
                        _scale_anchor(a, factor)
                    new_bases.append(lg)
                    new_base_records.append(br)
                bases, base_records = new_bases, new_base_records

                # Apply back + sort
                st.MarkCoverage.glyphs = marks
                st.MarkArray.MarkRecord = mark_records
                st.BaseCoverage.glyphs = bases
                st.BaseArray.BaseRecord = base_records

                st.BaseCoverage.glyphs, st.BaseArray.BaseRecord = _sort_coverage_and_parallel(
                    st.BaseCoverage.glyphs, list(st.BaseArray.BaseRecord), glyph_to_id
                )
                st.MarkCoverage.glyphs, st.MarkArray.MarkRecord = _sort_coverage_and_parallel(
                    st.MarkCoverage.glyphs, list(st.MarkArray.MarkRecord), glyph_to_id
                )
                kept_subtables.append(raw)

            elif type(st).__name__ == "MarkMarkPos" and getattr(st, "Format", None) == 1:
                # Remap Mark1Coverage / Mark2Coverage + scale anchors
                m1 = list(getattr(st.Mark1Coverage, "glyphs", []) or [])
                m2 = list(getattr(st.Mark2Coverage, "glyphs", []) or [])
                m1recs = list(getattr(getattr(st, "Mark1Array", None), "MarkRecord", []) or [])
                m2recs = list(getattr(getattr(st, "Mark2Array", None), "Mark2Record", []) or [])

                new_m1, new_m1recs = [], []
                for g1, r1 in zip(m1, m1recs):
                    cp = eng_g2cp.get(g1)
                    if cp is None:
                        continue
                    lg = _legacy_glyph_for_cp(legacy, cp)
                    if not lg:
                        continue
                    _scale_anchor(getattr(r1, "MarkAnchor", None), factor)
                    new_m1.append(lg)
                    new_m1recs.append(r1)
                new_m2, new_m2recs = [], []
                for g2, r2 in zip(m2, m2recs):
                    cp = eng_g2cp.get(g2)
                    if cp is None:
                        continue
                    lg = _legacy_glyph_for_cp(legacy, cp)
                    if not lg:
                        continue
                    # scale Mark2 anchors (matrix)
                    for anch_list in getattr(r2, "Mark2Anchor", []) or []:
                        _scale_anchor(anch_list, factor)
                    new_m2.append(lg)
                    new_m2recs.append(r2)

                st.Mark1Coverage.glyphs = new_m1
                st.Mark1Array.MarkRecord = new_m1recs
                st.Mark2Coverage.glyphs = new_m2
                st.Mark2Array.Mark2Record = new_m2recs

                st.Mark1Coverage.glyphs, st.Mark1Array.MarkRecord = _sort_coverage_and_parallel(
                    st.Mark1Coverage.glyphs, list(st.Mark1Array.MarkRecord), glyph_to_id
                )
                st.Mark2Coverage.glyphs, st.Mark2Array.Mark2Record = _sort_coverage_and_parallel(
                    st.Mark2Coverage.glyphs, list(st.Mark2Array.Mark2Record), glyph_to_id
                )
                kept_subtables.append(raw)

        lookup.SubTable = kept_subtables

    return gpos


def _remap_gdef(engine_gdef: Any, *, engine: TTFont, legacy: TTFont) -> Any:
    gdef = copy.deepcopy(engine_gdef)
    eng_g2cp = _build_engine_glyph_to_cp(engine)
    clsdef = getattr(gdef, "GlyphClassDef", None)
    if clsdef and hasattr(clsdef, "classDefs"):
        new_defs: Dict[str, int] = {}
        for eg, cls in clsdef.classDefs.items():
            cp = eng_g2cp.get(eg)
            if cp is None:
                continue
            lg = _legacy_glyph_for_cp(legacy, cp)
            if not lg:
                continue
            new_defs[lg] = int(cls)
        clsdef.classDefs = new_defs

    # ב-Engine עלולים להיות מבני GDEF נוספים (LigCaretList וכו') שמכילים גליפים לטיניים
    # שאינם קיימים ב-Legacy, וגורמים ל-KeyError בשמירה. כרגע אנחנו לא צריכים אותם
    # לניקוד/טעמים, ולכן מנטרלים אותם בבטחה.
    if hasattr(gdef, "LigCaretList"):
        gdef.LigCaretList = None
    if hasattr(gdef, "MarkAttachClassDef"):
        gdef.MarkAttachClassDef = None
    if hasattr(gdef, "MarkGlyphSetsDef"):
        gdef.MarkGlyphSetsDef = None
    return gdef


def main() -> None:
    ap = argparse.ArgumentParser(description="ייבוא GPOS/GDEF מ-Engine לתוך Legacy + החלת JSON ניקוד")
    ap.add_argument("--legacy", "-l", required=True, help="פונט בסיס (למשל Avigail)")
    ap.add_argument("--engine", "-e", required=True, help="פונט מנוע ניקוד (למשל Frank Ruhl Libre)")
    ap.add_argument("--project", "-p", required=True, help="nikkud-project.json")
    ap.add_argument("--output", "-o", required=True, help="פלט TTF/OTF")
    ap.add_argument("--export-font-name", default="", help="שם משפחה/תצוגה לפלט (טבלת name). ריק = ללא שינוי.")
    args = ap.parse_args()

    apply_script = _repo_root() / "hebrew-nikkud-web-editor" / "scripts" / "apply_nikkud_project.py"
    if not apply_script.is_file():
        raise SystemExit(f"לא נמצא {apply_script}")

    _stage("טוען Legacy + Engine")
    legacy = TTFont(args.legacy)
    engine = TTFont(args.engine)
    try:
        _require_glyf(legacy, "Legacy")
        _require_glyf(engine, "Engine")

        # Ensure mark/taamim glyphs exist in legacy so GPOS references resolve
        cps = list(range(0x0591, 0x05C8)) + [0x05C0, 0x05C3]
        _stage("מוודא גליפי ניקוד/טעמים ב-Legacy (העתקה מה-Engine כשחסר)…")
        _ensure_marks_present(legacy=legacy, engine=engine, cps=cps)

        if "GPOS" not in engine:
            raise SystemExit("ל-Engine אין GPOS, אין מה לייבא.")
        _stage("מייבא וממפה GPOS (כולל סקייל עוגנים)…")
        legacy["GPOS"] = copy.deepcopy(engine["GPOS"])
        legacy["GPOS"].table = _remap_and_scale_gpos(engine["GPOS"].table, engine=engine, legacy=legacy)

        if "GDEF" in engine:
            _stage("מייבא GDEF (מחלקות mark)…")
            legacy["GDEF"] = copy.deepcopy(engine["GDEF"])
            legacy["GDEF"].table = _remap_gdef(engine["GDEF"].table, engine=engine, legacy=legacy)

        # Save temp
        out_path = Path(args.output)
        tmp_path = out_path.with_name(out_path.stem + "-imported.tmp" + out_path.suffix)
        _stage("שומר קובץ זמני אחרי ייבוא GPOS…")
        legacy.save(str(tmp_path))
    finally:
        legacy.close()
        engine.close()

    cmd = [
        sys.executable,
        str(apply_script),
        "-i",
        str(tmp_path.resolve()),
        "-p",
        str(Path(args.project).resolve()),
        "-o",
        str(Path(args.output).resolve()),
    ]
    _stage("מריץ apply_nikkud_project על Legacy עם GPOS מיובא…")
    proc = subprocess.run(cmd, cwd=str(_repo_root()))
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)
    try:
        tmp_path.unlink(missing_ok=True)
    except Exception:
        pass
    if (args.export_font_name or "").strip():
        _stage("מעדכן טבלת name לפי שם הייצוא…")
        outp = Path(args.output)
        ft = TTFont(str(outp))
        try:
            apply_export_font_name(ft, args.export_font_name)
            _sanitize_os2_for_windows_install(ft)
            ft.save(str(outp))
        finally:
            ft.close()
    _stage("סיום: " + str(Path(args.output).resolve()))


if __name__ == "__main__":
    main()

