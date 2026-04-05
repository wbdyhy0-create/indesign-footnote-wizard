#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עורך מיקום ניקוד וטעמים בגופנים עבריים (TTF/OTF) דרך טבלת GPOS — Mark-to-Base.
גרירה מעדכנת את נקודת העיגון של האות (BaseAnchor) למחלקת הסימון, כך שהשינוי חל
על האות הנבחרת בלבד (ולא על עוגן הסימון שמשותף לכל הבסיסים).
"""

from __future__ import annotations

import os
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from typing import Any, Callable, List, Optional, Tuple

from fontTools.misc.bezierTools import cubicPointAtT
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables

from windows_font_dirs import default_font_open_dir


# סינון קבצים ל־Windows: נקודה-פסיק בין סיומות (רווח לא תמיד עובד ב־Common Dialog).
_FONT_FILETYPES = [
    ("גופן TTF / OTF", "*.ttf;*.TTF;*.otf;*.OTF"),
    ("TrueType (*.ttf)", "*.ttf;*.TTF"),
    ("OpenType (*.otf)", "*.otf;*.OTF"),
    ("כל הקבצים", "*.*"),
]


# --- Unicode sets ---

HEBREW_LETTER_CODES: Tuple[int, ...] = tuple(range(0x05D0, 0x05EB))

_MARK_RANGES: Tuple[Tuple[int, int], ...] = (
    (0x0591, 0x05AF + 1),
    (0x05B0, 0x05BD + 1),
    (0x05BF, 0x05BF + 1),
    (0x05C1, 0x05C2 + 1),
    (0x05C4, 0x05C7 + 1),
)


def _all_mark_codes() -> List[int]:
    codes: List[int] = []
    for a, b in _MARK_RANGES:
        codes.extend(range(a, b))
    return sorted(set(codes))


ALL_MARK_CODES: Tuple[int, ...] = tuple(_all_mark_codes())


def _cp_label(cp: int) -> str:
    ch = chr(cp)
    return f"U+{cp:04X}  {ch}"


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


class MarkBaseIndex:
    """מצביע לרשומת Mark-to-Base ספציפית בטבלה (לעריכה במקום)."""

    def __init__(
        self,
        subtable: Any,
        base_index: int,
        mark_index: int,
        mark_class: int,
    ) -> None:
        self.subtable = subtable
        self.base_index = base_index
        self.mark_index = mark_index
        self.mark_class = mark_class

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
        br.BaseAnchor[self.mark_class] = anchor


def _unwrap_gpos_subtable(sub: Any) -> Any:
    """GPOS לעיתים עוטף MarkBasePos ב־ExtensionPos — חייבים לפתוח לפני חיפוש."""
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
            if type(st).__name__ != "MarkBasePos":
                continue
            if getattr(st, "Format", None) == 1:
                out.append(st)
    return out


def find_mark_base_for_pair(
    font: TTFont, base_name: str, mark_name: str
) -> Optional[MarkBaseIndex]:
    for st in iter_mark_base_subtables(font):
        try:
            bases = st.BaseCoverage.glyphs
            marks = st.MarkCoverage.glyphs
        except AttributeError:
            continue
        if base_name not in bases or mark_name not in marks:
            continue
        bi = bases.index(base_name)
        mi = marks.index(mark_name)
        mrec = st.MarkArray.MarkRecord[mi]
        cls = int(mrec.Class)
        if cls < 0 or cls >= st.ClassCount:
            continue
        return MarkBaseIndex(st, bi, mi, cls)
    return None


def collect_marks_in_font(font: TTFont) -> List[int]:
    cmap = font.getBestCmap()
    return [cp for cp in ALL_MARK_CODES if cp in cmap]


def glyph_bounds(glyph_set: Any, name: str) -> Optional[Tuple[float, float, float, float]]:
    try:
        pen = BoundsPen(glyph_set)
        glyph_set[name].draw(pen)
        return pen.bounds
    except Exception:
        return None


class CanvasPolyPen(BasePen):
    """מפרק עקומות לפוליליינים לציור על Canvas."""

    def __init__(self, glyph_set: Any, curve_steps: int = 14) -> None:
        super().__init__(glyph_set)
        self.curve_steps = max(curve_steps, 4)
        self.paths: List[List[Tuple[float, float]]] = []
        self._cur: Optional[List[Tuple[float, float]]] = None
        self._path_start: Optional[Tuple[float, float]] = None

    def _moveTo(self, pt: Tuple[float, float]) -> None:
        self._flush_open()
        p = (float(pt[0]), float(pt[1]))
        self._cur = [p]
        self._path_start = p

    def _lineTo(self, pt: Tuple[float, float]) -> None:
        if self._cur is None:
            self._moveTo(pt)
            return
        self._cur.append((float(pt[0]), float(pt[1])))

    def _curveToOne(
        self,
        bcp1: Tuple[float, float],
        bcp2: Tuple[float, float],
        pt: Tuple[float, float],
    ) -> None:
        if self._cur is None:
            return
        p0 = self._cur[-1]
        for i in range(1, self.curve_steps + 1):
            t = i / self.curve_steps
            self._cur.append(cubicPointAtT(p0, bcp1, bcp2, pt, t))

    def _closePath(self) -> None:
        if self._cur and self._path_start and self._cur[-1] != self._path_start:
            self._cur.append(self._path_start)
        self._flush_open()

    def _endPath(self) -> None:
        self._flush_open()

    def _flush_open(self) -> None:
        if self._cur is not None and len(self._cur) >= 2:
            self.paths.append(self._cur)
        self._cur = None
        self._path_start = None

    def flush(self) -> None:
        self._flush_open()


class PreviewCanvas(tk.Canvas):
    def __init__(self, master: tk.Widget, **kw: Any) -> None:
        super().__init__(master, background="#f4f4f4", **kw)
        self._scale = 0.15
        self._ox = 200.0
        self._oy = 350.0
        self._items: List[int] = []
        self._drag_start: Optional[Tuple[int, int]] = None
        self._on_drag_delta: Optional[Callable[[float, float], None]] = None

        self.bind("<ButtonPress-1>", self._on_press)
        self.bind("<B1-Motion>", self._on_motion)
        self.bind("<ButtonRelease-1>", self._on_release)

    def set_transform(self, scale: float, ox: float, oy: float) -> None:
        self._scale = scale
        self._ox = ox
        self._oy = oy

    def font_to_canvas(self, fx: float, fy: float) -> Tuple[float, float]:
        cx = self._ox + fx * self._scale
        cy = self._oy - fy * self._scale
        return cx, cy

    def canvas_to_font(self, cx: float, cy: float) -> Tuple[float, float]:
        fx = (cx - self._ox) / self._scale
        fy = (self._oy - cy) / self._scale
        return fx, fy

    def clear(self) -> None:
        for i in self._items:
            self.delete(i)
        self._items.clear()

    def draw_paths(
        self, paths: List[List[Tuple[float, float]]], fill: str, width: int = 1
    ) -> None:
        for path in paths:
            if len(path) < 2:
                continue
            flat: List[float] = []
            for fx, fy in path:
                cx, cy = self.font_to_canvas(fx, fy)
                flat.extend([cx, cy])
            iid = self.create_line(*flat, fill=fill, width=width, smooth=False)
            self._items.append(iid)

    def draw_cross(self, fx: float, fy: float, color: str, r: int = 5) -> None:
        cx, cy = self.font_to_canvas(fx, fy)
        i1 = self.create_line(cx - r, cy, cx + r, cy, fill=color, width=2)
        i2 = self.create_line(cx, cy - r, cx, cy + r, fill=color, width=2)
        self._items.extend([i1, i2])

    def set_drag_callback(self, cb: Optional[Callable[[float, float], None]]) -> None:
        self._on_drag_delta = cb

    def _on_press(self, e: tk.Event) -> None:
        self._drag_start = (e.x, e.y)

    def _on_motion(self, e: tk.Event) -> None:
        if self._drag_start is None or not self._on_drag_delta:
            return
        dx = e.x - self._drag_start[0]
        dy = e.y - self._drag_start[1]
        self._drag_start = (e.x, e.y)
        dxf = dx / self._scale
        dyf = -dy / self._scale
        self._on_drag_delta(dxf, dyf)

    def _on_release(self, _e: tk.Event) -> None:
        self._drag_start = None


class HebrewMarkEditorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("עורך מיקום ניקוד וטעמים (GPOS Mark-to-Base)")
        self.geometry("1100x720")
        self.minsize(900, 600)

        self.font: Optional[TTFont] = None
        self.font_path: Optional[str] = None
        self.glyph_set: Any = None
        self._dirty = False

        self._base_cp = 0x05D0
        self._mark_cp = 0x05B7
        self._mbi: Optional[MarkBaseIndex] = None

        self._build_ui()

    def _build_ui(self) -> None:
        top = ttk.Frame(self, padding=6)
        top.pack(fill=tk.X)

        ttk.Button(top, text="פתח גופן…", command=self._open_font).pack(side=tk.LEFT, padx=2)
        ttk.Button(top, text="שמור גופן בשם…", command=self._save_font_as).pack(
            side=tk.LEFT, padx=2
        )
        self._status = ttk.Label(top, text="לא נטען גופן")
        self._status.pack(side=tk.LEFT, padx=12)

        mid = ttk.Panedwindow(self, orient=tk.HORIZONTAL)
        mid.pack(fill=tk.BOTH, expand=True, padx=6, pady=4)

        left = ttk.Frame(mid, padding=4)
        mid.add(left, weight=0)

        self._letter_label = ttk.Label(left, text="אות בסיס: א")
        self._letter_label.pack(anchor=tk.W)

        letters_f = ttk.Frame(left)
        letters_f.pack(fill=tk.X)
        row = 0
        col = 0
        for cp in HEBREW_LETTER_CODES:
            ch = chr(cp)
            ttk.Button(
                letters_f,
                text=ch,
                width=3,
                command=lambda c=cp: self._select_letter(c),
            ).grid(row=row, column=col, padx=1, pady=1)
            col += 1
            if col >= 11:
                col = 0
                row += 1

        ttk.Label(left, text="סימן (ניקוד / טעם)").pack(anchor=tk.W, pady=(10, 0))
        self._mark_list = tk.Listbox(left, height=16, width=22, exportselection=False)
        self._mark_list.pack(fill=tk.BOTH, expand=True)
        self._mark_list.bind("<<ListboxSelect>>", lambda _e: self._on_mark_pick())

        ttk.Label(left, text="הזזה עדינה (יחידות גופן)").pack(anchor=tk.W, pady=(8, 0))
        nudge = ttk.Frame(left)
        nudge.pack(fill=tk.X)
        for lbl, dx, dy in (
            ("←", -20, 0),
            ("→", 20, 0),
            ("↑", 0, 20),
            ("↓", 0, -20),
        ):
            ttk.Button(
                nudge, text=lbl, width=4, command=lambda x=dx, y=dy: self._nudge(x, y)
            ).pack(side=tk.LEFT, padx=1)

        ttk.Label(
            left,
            text="גרור על התצוגה כדי להזיז את הסימון.\n"
            "השינוי נשמר ב־BaseAnchor של האות למחלקת הסימון.",
            wraplength=220,
        ).pack(anchor=tk.W, pady=(8, 0))

        right = ttk.Frame(mid)
        mid.add(right, weight=1)

        self._canvas = PreviewCanvas(right, highlightthickness=1, highlightbackground="#ccc")
        self._canvas.pack(fill=tk.BOTH, expand=True)
        self._canvas.set_drag_callback(self._on_drag_font_units)

        self._info = ttk.Label(right, text="", wraplength=600)
        self._info.pack(fill=tk.X, pady=4)

        self._select_letter(self._base_cp)

    def _open_font(self) -> None:
        path = filedialog.askopenfilename(
            title="בחר קובץ גופן",
            parent=self,
            initialdir=default_font_open_dir(),
            filetypes=_FONT_FILETYPES,
        )
        if not path:
            return
        try:
            f = TTFont(path)
        except Exception as ex:
            messagebox.showerror("שגיאה", f"לא ניתן לטעון את הקובץ:\n{ex}")
            return
        if "GPOS" not in f:
            f.close()
            messagebox.showwarning("אזהרה", "לקובץ אין טבלת GPOS — אין Mark-to-Base לעריכה.")
            return
        if self.font:
            self.font.close()
        self.font = f
        self.font_path = path
        self.glyph_set = f.getGlyphSet()
        self._dirty = False
        self._status.configure(text=path)
        self._fill_mark_list()
        self._refresh_preview()

    def _fill_mark_list(self) -> None:
        self._mark_list.delete(0, tk.END)
        if not self.font:
            return
        for cp in collect_marks_in_font(self.font):
            self._mark_list.insert(tk.END, _cp_label(cp))
        if self._mark_list.size():
            self._mark_list.selection_set(0)
            self._on_mark_pick()

    def _current_mark_cp(self) -> Optional[int]:
        if not self.font or not self._mark_list.curselection():
            return None
        idx = int(self._mark_list.curselection()[0])
        text = self._mark_list.get(idx)
        u = text.split()[0]
        return int(u[2:], 16)

    def _select_letter(self, cp: int) -> None:
        self._base_cp = cp
        self._letter_label.configure(text=f"אות בסיס: {chr(cp)}")
        self._refresh_preview()

    def _on_mark_pick(self) -> None:
        cp = self._current_mark_cp()
        if cp is not None:
            self._mark_cp = cp
        self._refresh_preview()

    def _glyph_name(self, cp: int) -> Optional[str]:
        if not self.font:
            return None
        return self.font.getBestCmap().get(cp)

    def _draw_glyph_paths(
        self, gname: str, ox: float, oy: float, color: str
    ) -> None:
        if not self.glyph_set:
            return
        try:
            pen = CanvasPolyPen(self.glyph_set)
            wrapped = TransformPen(pen, (1, 0, 0, 1, ox, oy))
            self.glyph_set[gname].draw(wrapped)
            pen.flush()
            self._canvas.draw_paths(pen.paths, fill=color, width=1)
        except Exception:
            pass

    def _refresh_preview(self) -> None:
        self._canvas.clear()
        if not self.font or not self.glyph_set:
            self._info.configure(text="טען גופן כדי להתחיל.")
            return

        base_name = self._glyph_name(self._base_cp)
        mark_cp = self._current_mark_cp() or self._mark_cp
        mark_name = self._glyph_name(mark_cp) if mark_cp else None

        if not base_name:
            self._info.configure(text="לא נמצא גליף לאות זו ב־cmap.")
            return
        if not mark_name:
            self._info.configure(text="בחר סימון מהרשימה (חייב להופיע בגופן).")
            return

        self._mbi = find_mark_base_for_pair(self.font, base_name, mark_name)
        if not self._mbi:
            self._info.configure(
                text=(
                    f"אין רשומת Mark-to-Base עבור:\nבסיס {base_name} + סימון {mark_name}\n"
                    "(ייתכן שהגופן משתמש במבנה אחר או חסר כיסוי ב־GPOS)."
                )
            )
            return

        mba = self._mbi.get_base_anchor()
        if mba is None:
            if not messagebox.askyesno(
                "אין עוגן בסיס",
                "למחלקה זו אין BaseAnchor על האות.\n"
                "ליצור עוגן חדש (0,0) ואז להזיז למיקום הנכון?",
            ):
                self._info.configure(text="בוטל — אין עוגן בסיס לעריכה.")
                return
            na = _ensure_anchor()
            self._mbi.set_base_anchor(na)
            self._dirty = True
            mba = na

        bx, by = _anchor_xy(mba)
        mark_anchor = self._mbi.get_mark_anchor()
        mx, my = _anchor_xy(mark_anchor)

        ox = bx - mx
        oy = by - my

        bb = glyph_bounds(self.glyph_set, base_name)
        mb = glyph_bounds(self.glyph_set, mark_name)

        all_pts: List[Tuple[float, float]] = []
        if bb:
            all_pts.extend([(bb[0], bb[1]), (bb[2], bb[3])])
        if mb:
            all_pts.extend([(mb[0] + ox, mb[1] + oy), (mb[2] + ox, mb[3] + oy)])
        if not all_pts:
            scale = 0.2
        else:
            minx = min(p[0] for p in all_pts)
            maxx = max(p[0] for p in all_pts)
            miny = min(p[1] for p in all_pts)
            maxy = max(p[1] for p in all_pts)
            w = max(maxx - minx, 50.0)
            h = max(maxy - miny, 50.0)
            scale = min(380.0 / w, 280.0 / h, 0.5)
        self._canvas.set_transform(scale, 420.0, 420.0)

        self._draw_glyph_paths(base_name, 0.0, 0.0, "#0d47a1")
        self._draw_glyph_paths(mark_name, ox, oy, "#b71c1c")

        self._canvas.draw_cross(bx, by, "#1565c0")
        self._canvas.draw_cross(ox + mx, oy + my, "#c62828")

        cls = self._mbi.mark_class
        self._info.configure(
            text=(
                f"בסיס: {base_name}  ({chr(self._base_cp)})   |   סימון: {mark_name}  ({chr(mark_cp)})\n"
                f"מחלקת סימון: {cls}   |   BaseAnchor: ({bx:.0f}, {by:.0f})   "
                f"MarkAnchor: ({mx:.0f}, {my:.0f})"
            )
        )

    def _apply_delta_to_base_anchor(self, dxf: float, dyf: float) -> None:
        if not self._mbi:
            return
        a = self._mbi.get_base_anchor()
        if a is None:
            a = _ensure_anchor()
            self._mbi.set_base_anchor(a)
        bx, by = _anchor_xy(a)
        _set_anchor_xy(a, bx + dxf, by + dyf)
        self._dirty = True
        self._refresh_preview()

    def _on_drag_font_units(self, dxf: float, dyf: float) -> None:
        self._apply_delta_to_base_anchor(dxf, dyf)

    def _nudge(self, dxf: int, dyf: int) -> None:
        self._apply_delta_to_base_anchor(float(dxf), float(dyf))

    def _save_font_as(self) -> None:
        if not self.font:
            messagebox.showinfo("שמירה", "אין גופן טעון.")
            return
        path = filedialog.asksaveasfilename(
            title="שמור גופן",
            parent=self,
            defaultextension=".ttf",
            filetypes=[
                ("TrueType (*.ttf)", "*.ttf"),
                ("OpenType (*.otf)", "*.otf"),
                ("כל הקבצים", "*.*"),
            ],
        )
        if not path:
            return
        try:
            self.font.save(path, reorderTables=True)
            self._dirty = False
            messagebox.showinfo("שמירה", f"נשמר:\n{path}")
        except Exception as ex:
            messagebox.showerror("שגיאה", str(ex))


def main() -> None:
    app = HebrewMarkEditorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
