# -*- coding: utf-8 -*-
"""ייבוא גליפי סימני עברית (טעמים/ניקוד) מגופן TTF אחד לאחר + העתקת GPOS אופציונלי."""

from __future__ import annotations

from copy import deepcopy
from typing import Dict, List, Optional, Tuple

from fontTools.ttLib import TTFont

from font_loader import _anchor_xy, _set_anchor_xy, iter_mark_base_subtables, iter_mark_mark_subtables
# (קוד יוניקוד, תיאור קצר בעברית)
TAAMIM_ROWS: List[Tuple[int, str]] = [
    (0x0591, "אתנחתא"),
    (0x0592, "סגול-טעם"),
    (0x0593, "שלשלת"),
    (0x0594, "זקף-קטן"),
    (0x0595, "זקף-גדול"),
    (0x0596, "תביר"),
    (0x0597, "רביע"),
    (0x0598, "זרקא"),
    (0x0599, "פשטא"),
    (0x059A, "יתיב"),
    (0x059B, "תביר2"),
    (0x059C, "גרש"),
    (0x059D, "גרש-מוקדם"),
    (0x059E, "גרשיים"),
    (0x059F, "קרני-פרה"),
    (0x05A0, "תלישא-גדולה"),
    (0x05A1, "פזר"),
    (0x05A3, "מונח"),
    (0x05A4, "מהפך"),
    (0x05A5, "מרכא"),
    (0x05A6, "מרכא-כפולה"),
    (0x05A7, "דרגא"),
    (0x05A8, "קדמא"),
    (0x05A9, "תלישא-קטנה"),
    (0x05AA, "ירח-בן-יומו"),
    (0x05AB, "אולה"),
    (0x05AC, "אילוי"),
    (0x05AD, "דחי"),
    (0x05AE, "זינור"),
    (0x05AF, "מסורה"),
]

TAAMIM_CODEPOINTS = tuple(cp for cp, _ in TAAMIM_ROWS)

# ניקוד/סימני עזר (עברית): U+05B0..U+05BD, U+05BF, U+05C1..U+05C2, U+05C4..U+05C7
NIQQUD_ROWS: List[Tuple[int, str]] = [
    (0x05B0, "שווא"),
    (0x05B1, "חטף-סגול"),
    (0x05B2, "חטף-פתח"),
    (0x05B3, "חטף-קמץ"),
    (0x05B4, "חיריק"),
    (0x05B5, "צירי"),
    (0x05B6, "סגול"),
    (0x05B7, "פתח"),
    (0x05B8, "קמץ"),
    (0x05B9, "חולם"),
    (0x05BB, "קובוץ"),
    (0x05BC, "דגש/מפיק"),
    (0x05BD, "מתג"),
    (0x05BF, "רפה"),
    (0x05C1, "שין-ימנית"),
    (0x05C2, "שין-שמאלית"),
    (0x05C4, "נקודה עליונה"),
    (0x05C5, "נקודה תחתונה"),
    (0x05C7, "קמץ קטן"),
]

NIQQUD_CODEPOINTS = tuple(cp for cp, _ in NIQQUD_ROWS)


def _is_ttf_with_glyf(font: TTFont) -> bool:
    return "glyf" in font and font["glyf"] is not None


def _pick_target_glyph_name(
    target: TTFont, unicode_val: int, source_glyph_name: str
) -> str:
    """אם כבר יש מיפוי לקוד ביעד — משתמשים בשם הקיים; אחרת uniXXXX."""
    tcmap = target.getBestCmap() or {}
    existing = tcmap.get(unicode_val)
    if existing:
        return existing
    uni_name = f"uni{unicode_val:04X}"
    if uni_name not in target.getGlyphSet():
        return uni_name
    # התנגשות נדירה
    i = 1
    while f"{uni_name}_{i}" in target.getGlyphSet():
        i += 1
    return f"{uni_name}_{i}"


def _set_cmap_unicode(target: TTFont, code: int, glyph_name: str) -> None:
    for table in target["cmap"].tables:
        if table.isUnicode():
            table.cmap[code] = glyph_name


def _add_to_glyph_order(target: TTFont, glyph_name: str) -> None:
    order = list(target.getGlyphOrder())
    if glyph_name not in order:
        order.append(glyph_name)
        target.setGlyphOrder(order)


def import_glyph(
    source: TTFont, target: TTFont, unicode_val: int, overwrite: bool = True
) -> Tuple[bool, str]:
    """
    מעתיק גליף אחד ממקור ליעד (TTF עם glyf).
    אם היעד כבר מכיל את הקוד ב-cmap — מחליף את ה-outline תחת אותו שם (כש-overwrite).
    """
    if not _is_ttf_with_glyf(source):
        return False, "גופן המקור אינו TTF עם טבלת glyf."
    if not _is_ttf_with_glyf(target):
        return False, "גופן היעד אינו TTF עם טבלת glyf (למשל CFF בלבד)."

    scmap = source.getBestCmap() or {}
    sname = scmap.get(unicode_val)
    if not sname or sname not in source.getGlyphSet():
        return False, "הגליף לא קיים בגופן המקור."

    sglyph = source["glyf"][sname]
    if sglyph.isComposite():
        return False, "גליף מרוכב — רכיבי משנה לא מיובאים אוטומטית."

    tname = _pick_target_glyph_name(target, unicode_val, sname)
    if tname in target.getGlyphSet() and not overwrite:
        return False, "הגליף כבר קיים ביעד (לא הוחלף)."

    new_g = deepcopy(sglyph)
    target["glyf"][tname] = new_g

    aw, lsb = source["hmtx"][sname]
    target["hmtx"][tname] = (int(aw), int(lsb))

    if "vmtx" in source and "vmtx" in target:
        try:
            if sname in source["vmtx"].metrics:
                target["vmtx"][tname] = deepcopy(source["vmtx"][sname])
        except Exception:
            pass

    _add_to_glyph_order(target, tname)
    _set_cmap_unicode(target, unicode_val, tname)
    return True, f"יובא כ־{tname}"


def import_taamim(
    source: TTFont,
    target: TTFont,
    codepoints: Optional[List[int]] = None,
) -> Tuple[int, List[str]]:
    """מחזיר (מספר מוצלחים, רשימת הודעות שגיאה/דילוג)."""
    cps = list(codepoints) if codepoints is not None else list(TAAMIM_CODEPOINTS)
    ok = 0
    errs: List[str] = []
    for cp in cps:
        success, msg = import_glyph(source, target, cp, overwrite=True)
        if success:
            ok += 1
        else:
            errs.append(f"U+{cp:04X}: {msg}")
    return ok, errs


def import_niqqud(
    source: TTFont,
    target: TTFont,
    codepoints: Optional[List[int]] = None,
) -> Tuple[int, List[str]]:
    """ייבוא ניקוד/סימני עזר נפוצים."""
    cps = list(codepoints) if codepoints is not None else list(NIQQUD_CODEPOINTS)
    ok = 0
    errs: List[str] = []
    for cp in cps:
        success, msg = import_glyph(source, target, cp, overwrite=True)
        if success:
            ok += 1
        else:
            errs.append(f"U+{cp:04X}: {msg}")
    return ok, errs


def _mark_anchor_for_glyph(font: TTFont, glyph_name: str) -> Tuple[float, float]:
    """Best-effort: locate MarkAnchor (FU) for this mark glyph (MarkToBase or MarkToMark Mark1)."""
    # MarkToBase
    for st in iter_mark_base_subtables(font):
        try:
            marks = st.MarkCoverage.glyphs
        except Exception:
            continue
        if glyph_name in marks:
            try:
                mi = marks.index(glyph_name)
                anch = st.MarkArray.MarkRecord[mi].MarkAnchor
                return _anchor_xy(anch)
            except Exception:
                pass
    # MarkToMark (mark1)
    for st in iter_mark_mark_subtables(font):
        try:
            m1 = st.Mark1Coverage.glyphs
        except Exception:
            continue
        if glyph_name in m1:
            try:
                i1 = m1.index(glyph_name)
                anch = st.Mark1Array.MarkRecord[i1].MarkAnchor
                return _anchor_xy(anch)
            except Exception:
                pass
    return 0.0, 0.0


def scale_mark_glyphs_in_place(
    font: TTFont, glyph_names: List[str], factor: float
) -> Tuple[int, List[str]]:
    """
    Scales mark glyph outlines in-place around their MarkAnchor (so attachment point stays put).
    Returns (scaled_count, errs).

    Limitations:
    - TrueType glyf only
    - Composite glyphs are skipped
    """
    if factor <= 0:
        return 0, ["factor must be > 0"]
    if "glyf" not in font:
        return 0, ["target font has no glyf table"]
    glyf = font["glyf"]
    scaled = 0
    errs: List[str] = []
    for gname in glyph_names:
        try:
            if gname not in glyf.glyphs:
                continue
            g = glyf[gname]
            if g.isComposite():
                errs.append(f"{gname}: composite glyph not scaled")
                continue
            ax, ay = _mark_anchor_for_glyph(font, gname)
            coords, end_pts, flags = g.getCoordinates(glyf)
            if coords is None or len(coords) == 0:
                continue
            for i in range(len(coords)):
                x, y = coords[i]
                coords[i] = (ax + (x - ax) * factor, ay + (y - ay) * factor)
            g.setCoordinates(coords, glyf)
            try:
                g.recalcBounds(glyf)
            except Exception:
                pass
            scaled += 1
        except Exception as e:
            errs.append(f"{gname}: {e}")
    return scaled, errs


def copy_gpos_table(source: TTFont, target: TTFont) -> Tuple[bool, str]:
    if "GPOS" not in source:
        return False, "אין GPOS בגופן המקור."
    target["GPOS"] = deepcopy(source["GPOS"])
    return True, "טבלת GPOS הועתקה."


def scale_mark_anchors_in_font(font: TTFont, factor: float) -> int:
    """
    מכפיל קואורדינטות בעוגני MarkToBase ו-MarkToMark בלבד (כולל ExtensionPos).
    """
    n = 0

    def scale_anchor(a) -> None:
        nonlocal n
        if a is None:
            return
        x, y = _anchor_xy(a)
        _set_anchor_xy(a, x * factor, y * factor)
        n += 1

    for st in iter_mark_base_subtables(font):
        for rec in st.MarkArray.MarkRecord:
            scale_anchor(rec.MarkAnchor)
        for br in st.BaseArray.BaseRecord:
            for a in br.BaseAnchor:
                scale_anchor(a)

    for st in iter_mark_mark_subtables(font):
        for rec in st.Mark1Array.MarkRecord:
            scale_anchor(rec.MarkAnchor)
        for m2 in st.Mark2Array.Mark2Record:
            for a in m2.Mark2Anchor:
                scale_anchor(a)

    return n


def copy_gpos_and_scale_for_upem(
    source: TTFont, target: TTFont
) -> Tuple[bool, str]:
    """
    מעתיק GPOS ממקור ליעד ומקנה קנה מידה לעוגני Mark אם ה-UPEM שונה.
    """
    prev = deepcopy(target["GPOS"]) if "GPOS" in target else None
    ok, msg = copy_gpos_table(source, target)
    if not ok:
        return False, msg
    su = float(source["head"].unitsPerEm)
    tu = float(target["head"].unitsPerEm)
    if su <= 0 or abs(su - tu) < 1e-6:
        try:
            target["GPOS"].compile(target)
        except Exception as e:
            if prev is not None:
                target["GPOS"] = prev
            else:
                del target["GPOS"]
            return (
                False,
                "העתקת GPOS נכשלה (שמות גליפים לא תואמים בין מקור ליעד). "
                f"פרטים: {e}",
            )
        return True, msg + " UPEM זהה — ללא סקייל לעוגנים."
    f = tu / su
    nb = scale_mark_anchors_in_font(target, f)
    try:
        target["GPOS"].compile(target)
    except Exception as e:
        if prev is not None:
            target["GPOS"] = prev
        else:
            del target["GPOS"]
        return (
            False,
            "העתקת GPOS נכשלה (שמות גליפים לא תואמים בין מקור ליעד). "
            f"פרטים: {e}",
        )
    return True, f"{msg} סקייל עוגנים Mark: factor={f:.4f} (עודכנו {nb} עוגנים)."


def upem_pair_message(source: TTFont, target: TTFont) -> str:
    su = int(source["head"].unitsPerEm)
    tu = int(target["head"].unitsPerEm)
    if su == tu:
        return f"UPM: מקור {su}, יעד {tu} — תואם."
    return f"UPM: מקור {su}, יעד {tu} — מומלץ סקייל אוטומטי אחרי העתקת GPOS."
