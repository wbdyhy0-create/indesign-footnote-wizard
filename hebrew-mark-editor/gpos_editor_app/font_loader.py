# -*- coding: utf-8 -*-
"""טעינה ועדכון GPOS (MarkToBase, MarkToMark) עם fonttools — כולל ExtensionPos."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterator, List, Optional, Tuple

from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables


def _unwrap_gpos_subtable(sub: Any) -> Any:
    while type(sub).__name__ == "ExtensionPos":
        sub = sub.ExtSubTable
    return sub


def iter_mark_base_subtables(font: TTFont) -> List[Any]:
    if "GPOS" not in font:
        return []
    gpos = font["GPOS"].table
    if not gpos.LookupList:
        return []
    out: List[Any] = []
    for lookup in gpos.LookupList.Lookup:
        for raw in lookup.SubTable:
            st = _unwrap_gpos_subtable(raw)
            if type(st).__name__ == "MarkBasePos" and getattr(st, "Format", None) == 1:
                out.append(st)
    return out


def iter_mark_mark_subtables(font: TTFont) -> List[Any]:
    if "GPOS" not in font:
        return []
    gpos = font["GPOS"].table
    if not gpos.LookupList:
        return []
    out: List[Any] = []
    for lookup in gpos.LookupList.Lookup:
        for raw in lookup.SubTable:
            st = _unwrap_gpos_subtable(raw)
            if type(st).__name__ == "MarkMarkPos" and getattr(st, "Format", None) == 1:
                out.append(st)
    return out


def _anchor_xy(anchor: Any) -> Tuple[float, float]:
    if anchor is None:
        return 0.0, 0.0
    fmt = getattr(anchor, "Format", 1)
    if fmt in (1, 2, 3):
        return float(anchor.XCoordinate), float(anchor.YCoordinate)
    return 0.0, 0.0


def _set_anchor_xy(anchor: Any, x: float, y: float) -> None:
    if anchor is None:
        return
    anchor.Format = 1
    anchor.XCoordinate = int(round(x))
    anchor.YCoordinate = int(round(y))
    for attr in (
        "XDeviceTable",
        "YDeviceTable",
        "xDeviceTable",
        "yDeviceTable",
    ):
        if hasattr(anchor, attr):
            setattr(anchor, attr, None)


def _ensure_anchor() -> otTables.Anchor:
    a = otTables.Anchor()
    a.Format = 1
    a.XCoordinate = 0
    a.YCoordinate = 0
    return a


@dataclass
class MarkBaseIndex:
    subtable: Any
    base_index: int
    mark_index: int
    mark_class: int

    def get_base_anchor(self) -> Optional[Any]:
        br = self.subtable.BaseArray.BaseRecord[self.base_index]
        anchors = br.BaseAnchor
        if self.mark_class >= len(anchors):
            return None
        return anchors[self.mark_class]

    def get_mark_anchor(self) -> Any:
        return self.subtable.MarkArray.MarkRecord[self.mark_index].MarkAnchor

    def set_base_anchor(self, anchor: Any) -> None:
        br = self.subtable.BaseArray.BaseRecord[self.base_index]
        while len(br.BaseAnchor) <= self.mark_class:
            br.BaseAnchor.append(None)
        br.BaseAnchor[self.mark_class] = anchor


def find_mark_base_for_pair(
    font: TTFont, base_glyph: str, mark_glyph: str
) -> Optional[MarkBaseIndex]:
    for st in iter_mark_base_subtables(font):
        try:
            bases = st.BaseCoverage.glyphs
            marks = st.MarkCoverage.glyphs
        except AttributeError:
            continue
        if base_glyph not in bases or mark_glyph not in marks:
            continue
        bi = bases.index(base_glyph)
        mi = marks.index(mark_glyph)
        mrec = st.MarkArray.MarkRecord[mi]
        cls = int(mrec.Class)
        if cls < 0 or cls >= st.ClassCount:
            continue
        return MarkBaseIndex(st, bi, mi, cls)
    return None


@dataclass
class MarkMarkIndex:
    subtable: Any
    mark1_index: int
    mark2_index: int
    mark1_class: int

    def get_mark2_anchor(self) -> Optional[Any]:
        rec = self.subtable.Mark2Array.Mark2Record[self.mark2_index]
        anchors = rec.Mark2Anchor
        if self.mark1_class >= len(anchors):
            return None
        return anchors[self.mark1_class]

    def set_mark2_anchor(self, anchor: Any) -> None:
        rec = self.subtable.Mark2Array.Mark2Record[self.mark2_index]
        while len(rec.Mark2Anchor) <= self.mark1_class:
            rec.Mark2Anchor.append(None)
        rec.Mark2Anchor[self.mark1_class] = anchor


def find_mark_mark_for_pair(
    font: TTFont, mark1_glyph: str, mark2_glyph: str
) -> Optional[MarkMarkIndex]:
    """Mark1 = הטעם/סימן הראשון; Mark2 = הניקוד שמתחבר אליו (mkmk)."""
    for st in iter_mark_mark_subtables(font):
        try:
            m1 = st.Mark1Coverage.glyphs
            m2 = st.Mark2Coverage.glyphs
        except AttributeError:
            continue
        if mark1_glyph not in m1 or mark2_glyph not in m2:
            continue
        i1 = m1.index(mark1_glyph)
        i2 = m2.index(mark2_glyph)
        cls = int(st.Mark1Array.MarkRecord[i1].Class)
        if cls < 0 or cls >= st.ClassCount:
            continue
        return MarkMarkIndex(st, i1, i2, cls)
    return None


class FontLoader:
    """עטיפה על TTFont + GPOS לעריכת MarkToBase / MarkToMark."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.font = TTFont(path)
        self.cmap: Dict[int, str] = {}
        bc = self.font.getBestCmap()
        if bc:
            self.cmap = {int(k): v for k, v in bc.items() if isinstance(k, int)}
        self.glyph_set = self.font.getGlyphSet()
        self.upem = float(self.font["head"].unitsPerEm)

    def refresh_cmap(self) -> None:
        """לאחר ייבוא גליפים / שינוי cmap בזיכרון — רענון מטמון."""
        bc = self.font.getBestCmap()
        self.cmap = {
            int(k): v for k, v in bc.items() if isinstance(k, int)
        } if bc else {}
        self.glyph_set = self.font.getGlyphSet()
        self.upem = float(self.font["head"].unitsPerEm)

    def close(self) -> None:
        self.font.close()

    def get_glyph_name(self, unicode_val: int) -> Optional[str]:
        return self.cmap.get(unicode_val)

    def get_mark_to_base_anchors(self) -> Dict[Tuple[str, str], Tuple[int, int, int, int]]:
        """
        מחזיר {(base_glyph, mark_glyph): (base_anchor_x, base_anchor_y, mark_anchor_x, mark_anchor_y)}
        לפי כל תת־טבלאות MarkToBase (איחוד אחרון אם כפילות).
        """
        out: Dict[Tuple[str, str], Tuple[int, int, int, int]] = {}
        for st in iter_mark_base_subtables(self.font):
            bases = st.BaseCoverage.glyphs
            marks = st.MarkCoverage.glyphs
            for mi, mg in enumerate(marks):
                mrec = st.MarkArray.MarkRecord[mi]
                cls = int(mrec.Class)
                if cls < 0 or cls >= st.ClassCount:
                    continue
                mx, my = _anchor_xy(mrec.MarkAnchor)
                for bi, bg in enumerate(bases):
                    br = st.BaseArray.BaseRecord[bi]
                    if cls >= len(br.BaseAnchor):
                        continue
                    ba = br.BaseAnchor[cls]
                    if ba is None:
                        continue
                    bx, by = _anchor_xy(ba)
                    out[(bg, mg)] = (int(bx), int(by), int(mx), int(my))
        return out

    def get_mark_to_mark_anchors(self) -> Dict[Tuple[str, str], Tuple[int, int]]:
        """
        {(mark1_glyph, mark2_glyph): (mark2_on_mark1_x, mark2_on_mark1_y)}
        לפי Mark2Anchor במחלקה של Mark1.
        """
        out: Dict[Tuple[str, str], Tuple[int, int]] = {}
        for st in iter_mark_mark_subtables(self.font):
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
                    out[(g1, g2)] = (int(x), int(y))
        return out

    def find_mark_base(
        self, base_glyph: str, mark_glyph: str
    ) -> Optional[MarkBaseIndex]:
        return find_mark_base_for_pair(self.font, base_glyph, mark_glyph)

    def find_mark_mark(
        self, mark1_glyph: str, mark2_glyph: str
    ) -> Optional[MarkMarkIndex]:
        return find_mark_mark_for_pair(self.font, mark1_glyph, mark2_glyph)

    def set_base_anchor_xy(
        self, base_glyph: str, mark_glyph: str, bx: float, by: float, create: bool = True
    ) -> bool:
        mbi = self.find_mark_base(base_glyph, mark_glyph)
        if not mbi:
            return False
        ba = mbi.get_base_anchor()
        if ba is None:
            if not create:
                return False
            ba = _ensure_anchor()
            mbi.set_base_anchor(ba)
        _set_anchor_xy(ba, bx, by)
        return True

    def nudge_base_anchor(
        self, base_glyph: str, mark_glyph: str, dx: float, dy: float
    ) -> bool:
        mbi = self.find_mark_base(base_glyph, mark_glyph)
        if not mbi:
            return False
        ba = mbi.get_base_anchor()
        if ba is None:
            ba = _ensure_anchor()
            mbi.set_base_anchor(ba)
        x, y = _anchor_xy(ba)
        _set_anchor_xy(ba, x + dx, y + dy)
        return True

    def set_mark_to_mark_offset(
        self, mark1_glyph: str, mark2_glyph: str, x: float, y: float, create: bool = True
    ) -> bool:
        mmi = self.find_mark_mark(mark1_glyph, mark2_glyph)
        if not mmi:
            return False
        anch = mmi.get_mark2_anchor()
        if anch is None:
            if not create:
                return False
            anch = _ensure_anchor()
            mmi.set_mark2_anchor(anch)
        _set_anchor_xy(anch, x, y)
        return True

    def nudge_mark_to_mark(
        self, mark1_glyph: str, mark2_glyph: str, dx: float, dy: float
    ) -> bool:
        mmi = self.find_mark_mark(mark1_glyph, mark2_glyph)
        if not mmi:
            return False
        anch = mmi.get_mark2_anchor()
        if anch is None:
            anch = _ensure_anchor()
            mmi.set_mark2_anchor(anch)
        x, y = _anchor_xy(anch)
        _set_anchor_xy(anch, x + dx, y + dy)
        return True

    def iter_hebrew_bases(self) -> Iterator[Tuple[int, str]]:
        for cp in range(0x05D0, 0x05EB):
            g = self.cmap.get(cp)
            if g and g in self.glyph_set:
                yield cp, g

    def batch_nudge_mark_to_base_for_mark(
        self, mark_glyph: str, dx: float, dy: float
    ) -> int:
        """מזיז BaseAnchor של אותו סימון (מחלקה) על כל האותיות בכל תת־טבלאות MarkToBase."""
        n = 0
        for st in iter_mark_base_subtables(self.font):
            marks = st.MarkCoverage.glyphs
            if mark_glyph not in marks:
                continue
            mi = marks.index(mark_glyph)
            cls = int(st.MarkArray.MarkRecord[mi].Class)
            if cls < 0 or cls >= st.ClassCount:
                continue
            for bi in range(len(st.BaseCoverage.glyphs)):
                br = st.BaseArray.BaseRecord[bi]
                while len(br.BaseAnchor) <= cls:
                    br.BaseAnchor.append(None)
                ba = br.BaseAnchor[cls]
                if ba is None:
                    ba = _ensure_anchor()
                    br.BaseAnchor[cls] = ba
                x, y = _anchor_xy(ba)
                _set_anchor_xy(ba, x + dx, y + dy)
                n += 1
        return n

    def batch_nudge_mark_to_mark_pairs(
        self,
        pairs: List[Tuple[str, str]],
        dx: float,
        dy: float,
    ) -> int:
        """לכל זוג (טעם, ניקוד) שקיים ב־mkmk — הוסף dx,dy לעוגן Mark2."""
        n = 0
        for m1, m2 in pairs:
            if self.nudge_mark_to_mark(m1, m2, dx, dy):
                n += 1
        return n

    def save(self, output_path: str) -> None:
        self.font.save(output_path)
