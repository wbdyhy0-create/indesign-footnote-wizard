# -*- coding: utf-8 -*-
"""ייצוא והחלה של פרופיל GPOS (JSON) בין משקלי גופן — MarkToBase + MarkToMark."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple

from fontTools.ttLib import TTFont

from font_loader import (
    _anchor_xy,
    _ensure_anchor,
    _set_anchor_xy,
    find_mark_base_for_pair,
    find_mark_mark_for_pair,
    iter_mark_base_subtables,
    iter_mark_mark_subtables,
)

PROFILE_VERSION = 1


def _glyph_to_unicode_first(font: TTFont) -> Dict[str, int]:
    cmap = font.getBestCmap() or {}
    rev: Dict[str, int] = {}
    for u, g in cmap.items():
        if isinstance(u, int) and g not in rev:
            rev[g] = u
    return rev


def _mtb_key(bu: Optional[int], mu: Optional[int], bg: str, mg: str) -> str:
    if bu is not None and mu is not None:
        return f"{bu}_{mu}"
    return f"g:{bg}|{mg}"


def _mtm_key(u1: Optional[int], u2: Optional[int], g1: str, g2: str) -> str:
    if u1 is not None and u2 is not None:
        return f"{u1}_{u2}"
    return f"g:{g1}|{g2}"


def export_profile_dict(font: TTFont, display_name: str) -> Dict[str, Any]:
    gn2u = _glyph_to_unicode_first(font)
    profile: Dict[str, Any] = {
        "version": PROFILE_VERSION,
        "name": display_name,
        "upem": int(font["head"].unitsPerEm),
        "mark_to_base": {},
        "mark_to_mark": {},
    }
    if "GPOS" not in font:
        return profile

    for st in iter_mark_base_subtables(font):
        bases = st.BaseCoverage.glyphs
        marks = st.MarkCoverage.glyphs
        for mi, mg in enumerate(marks):
            mrec = st.MarkArray.MarkRecord[mi]
            mx, my = _anchor_xy(mrec.MarkAnchor)
            cls = int(mrec.Class)
            for bi, bg in enumerate(bases):
                br = st.BaseArray.BaseRecord[bi]
                if cls >= len(br.BaseAnchor):
                    continue
                ba = br.BaseAnchor[cls]
                if ba is None:
                    continue
                bx, by = _anchor_xy(ba)
                bu, mu = gn2u.get(bg), gn2u.get(mg)
                key = _mtb_key(bu, mu, bg, mg)
                profile["mark_to_base"][key] = {
                    "base_x": int(round(bx)),
                    "base_y": int(round(by)),
                    "mark_x": int(round(mx)),
                    "mark_y": int(round(my)),
                }

    for st in iter_mark_mark_subtables(font):
        m1g = st.Mark1Coverage.glyphs
        m2g = st.Mark2Coverage.glyphs
        for i2, g2 in enumerate(m2g):
            rec = st.Mark2Array.Mark2Record[i2]
            for i1, g1 in enumerate(m1g):
                cls = int(st.Mark1Array.MarkRecord[i1].Class)
                if cls >= len(rec.Mark2Anchor):
                    continue
                anch = rec.Mark2Anchor[cls]
                if anch is None:
                    continue
                x, y = _anchor_xy(anch)
                u1, u2 = gn2u.get(g1), gn2u.get(g2)
                key = _mtm_key(u1, u2, g1, g2)
                profile["mark_to_mark"][key] = {
                    "x": int(round(x)),
                    "y": int(round(y)),
                }

    return profile


def save_profile_json(font: TTFont, display_name: str, path: str) -> None:
    data = export_profile_dict(font, display_name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_profile_json(path: str) -> Dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _parse_pair_key(
    key: str,
) -> Tuple[Optional[int], Optional[int], Optional[str], Optional[str]]:
    if key.startswith("g:") and "|" in key:
        rest = key[2:]
        a, b = rest.split("|", 1)
        return None, None, a, b
    parts = key.split("_", 1)
    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
        return int(parts[0]), int(parts[1]), None, None
    return None, None, None, None


def _resolve_glyphs(
    font: TTFont,
    bu: Optional[int],
    mu: Optional[int],
    bg: Optional[str],
    mg: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    cmap = font.getBestCmap() or {}
    if bu is not None and mu is not None:
        return cmap.get(bu), cmap.get(mu)
    return bg, mg


def apply_profile_to_font(font: TTFont, profile: Dict[str, Any]) -> Tuple[int, int, int, int]:
    """
    מחיל ערכי עוגן מהפרופיל על GPOS הקיים בגופן.
    מחזיר (mark_to_base עודכן, mark_to_mark עודכן, דילוג mtb, דילוג mtm).
    """
    prof_upem = float(profile.get("upem") or font["head"].unitsPerEm)
    tgt_upem = float(font["head"].unitsPerEm)
    scale = tgt_upem / prof_upem if prof_upem > 0 else 1.0

    cmap = font.getBestCmap() or {}

    mtb_ok = mtb_skip = mtm_ok = mtm_skip = 0

    for key, d in (profile.get("mark_to_base") or {}).items():
        bu, mu, bg, mg = _parse_pair_key(key)
        bgn, mgn = _resolve_glyphs(font, bu, mu, bg, mg)
        if not bgn or not mgn:
            mtb_skip += 1
            continue
        mbi = find_mark_base_for_pair(font, bgn, mgn)
        if not mbi:
            mtb_skip += 1
            continue
        ba = mbi.get_base_anchor()
        if ba is None:
            ba = _ensure_anchor()
            mbi.set_base_anchor(ba)
        _set_anchor_xy(ba, float(d["base_x"]) * scale, float(d["base_y"]) * scale)
        _set_anchor_xy(
            mbi.get_mark_anchor(),
            float(d["mark_x"]) * scale,
            float(d["mark_y"]) * scale,
        )
        mtb_ok += 1

    for key, d in (profile.get("mark_to_mark") or {}).items():
        u1, u2, g1, g2 = _parse_pair_key(key)
        gn1, gn2 = _resolve_glyphs(font, u1, u2, g1, g2)
        if not gn1 or not gn2:
            mtm_skip += 1
            continue
        mmi = find_mark_mark_for_pair(font, gn1, gn2)
        if not mmi:
            mtm_skip += 1
            continue
        anch = mmi.get_mark2_anchor()
        if anch is None:
            anch = _ensure_anchor()
            mmi.set_mark2_anchor(anch)
        _set_anchor_xy(anch, float(d["x"]) * scale, float(d["y"]) * scale)
        mtm_ok += 1

    return mtb_ok, mtm_ok, mtb_skip, mtm_skip
