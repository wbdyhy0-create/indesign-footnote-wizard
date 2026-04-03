#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עורך תגין לגופנים עבריים — PyQt5 + fonttools + freetype-py + Pillow.
מוסיף קווים אנכיים עם נקודה עגולה מעל אותיות נבחרות ושומר TTF חדש.
"""

from __future__ import annotations

import json
import math
import os
import sys
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import freetype
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from PIL import Image, ImageQt

from windows_font_dirs import default_font_open_dir, launch_windows_font_search

from PyQt5.QtCore import QPoint, Qt, pyqtSignal
from PyQt5.QtGui import QBrush, QColor, QFont, QKeySequence, QPainter, QPen
from PyQt5.QtWidgets import (
    QAction,
    QApplication,
    QFileDialog,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSlider,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

# --- אותיות ותגין ---

THREE_TAGINIM_CP: Tuple[int, ...] = (0x05E9, 0x05E2, 0x05D8, 0x05E0, 0x05D6, 0x05D2, 0x05E6)
ONE_TAG_CP: Tuple[int, ...] = (0x05D1, 0x05D3, 0x05E7, 0x05D7, 0x05D9, 0x05D4)

PREVIEW_TEXT = "שמע ישראל ה אלהינו ה אחד"


def _cp_label(cp: int) -> str:
    return f"U+{cp:04X}  {chr(cp)}"


# קירוב מעגל בבזייה (יחס בקרה לרדיוס)
_CIRCLE_K = 0.5522847498


def _add_circle_contour(pen: TTGlyphPen, cx: float, cy: float, r: float) -> None:
    k = _CIRCLE_K * r
    pen.moveTo((cx + r, cy))
    pen.curveTo((cx + r, cy + k), (cx + k, cy + r), (cx, cy + r))
    pen.curveTo((cx - k, cy + r), (cx - r, cy + k), (cx - r, cy))
    pen.curveTo((cx - r, cy - k), (cx - k, cy - r), (cx, cy - r))
    pen.curveTo((cx + k, cy - r), (cx + r, cy - k), (cx + r, cy))
    pen.closePath()


def _add_rect_stem(pen: TTGlyphPen, cx: float, y_bottom: float, y_top: float, half_w: float) -> None:
    """מלבן אנכי; y עולה למעלה (יחידות גופן). כיוון חיצוני ל-TTF."""
    left = cx - half_w
    right = cx + half_w
    pen.moveTo((left, y_top))
    pen.lineTo((right, y_top))
    pen.lineTo((right, y_bottom))
    pen.lineTo((left, y_bottom))
    pen.closePath()


@dataclass
class TagPosition:
    """היסט ממרכז הגליף ב-X, ומקו העליון של ה-bounding box ב-Y (חיובי = למעלה)."""

    dx_fu: float = 0.0
    dy_fu: float = 0.0


@dataclass
class LetterSettings:
    codepoint: int
    tag_count: int
    height_frac: float = 0.15
    line_width_frac: float = 0.02
    dot_frac: float = 0.03
    spacing_frac: float = 0.08
    tags: List[TagPosition] = field(default_factory=list)

    def ensure_tags(self) -> None:
        n = self.tag_count
        while len(self.tags) < n:
            self.tags.append(TagPosition())
        self.tags = self.tags[:n]

    def to_json(self) -> Dict[str, Any]:
        self.ensure_tags()
        return {
            "codepoint": self.codepoint,
            "tag_count": self.tag_count,
            "height_frac": self.height_frac,
            "line_width_frac": self.line_width_frac,
            "dot_frac": self.dot_frac,
            "spacing_frac": self.spacing_frac,
            "tags": [{"dx_fu": t.dx_fu, "dy_fu": t.dy_fu} for t in self.tags],
        }

    @staticmethod
    def from_json(d: Dict[str, Any]) -> "LetterSettings":
        tags = [TagPosition(float(t["dx_fu"]), float(t["dy_fu"])) for t in d.get("tags", [])]
        ls = LetterSettings(
            codepoint=int(d["codepoint"]),
            tag_count=int(d["tag_count"]),
            height_frac=float(d.get("height_frac", 0.15)),
            line_width_frac=float(d.get("line_width_frac", 0.02)),
            dot_frac=float(d.get("dot_frac", 0.03)),
            spacing_frac=float(d.get("spacing_frac", 0.08)),
            tags=tags,
        )
        ls.ensure_tags()
        return ls


class TaginimEditorCanvas(QWidget):
    """תצוגת אות + תגין לגרירה (פיקסלים)."""

    tagDragStarted = pyqtSignal()
    tagDragged = pyqtSignal()

    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self.setFixedSize(400, 400)
        self.setMouseTracking(True)
        self._glyph_qimage: Optional[Any] = None
        self._ox: int = 0
        self._oy: int = 0
        self._px_per_fu: float = 1.0
        self._bbox_center_x_fu: float = 0.0
        self._bbox_top_fu: float = 0.0
        self._tag_count: int = 1
        self._tags_fu: List[TagPosition] = []
        self._stem_h_fu: float = 100.0
        self._stem_w_fu: float = 25.0
        self._dot_r_fu: float = 20.0
        self._slot_x_fu: List[float] = []
        self._drag_idx: Optional[int] = None
        self._last_mouse: Optional[QPoint] = None

    def set_render_state(
        self,
        qimage: Any,
        ox: int,
        oy: int,
        px_per_fu: float,
        bbox_center_x_fu: float,
        bbox_top_fu: float,
    ) -> None:
        self._glyph_qimage = qimage
        self._ox = ox
        self._oy = oy
        self._px_per_fu = max(px_per_fu, 1e-6)
        self._bbox_center_x_fu = bbox_center_x_fu
        self._bbox_top_fu = bbox_top_fu
        self.update()

    def set_geometry(
        self,
        tag_count: int,
        tags: List[TagPosition],
        slot_x_fu: List[float],
        stem_h_fu: float,
        stem_w_fu: float,
        dot_r_fu: float,
    ) -> None:
        self._tag_count = tag_count
        self._tags_fu = tags
        self._slot_x_fu = slot_x_fu[:tag_count] if len(slot_x_fu) >= tag_count else slot_x_fu + [0.0] * (tag_count - len(slot_x_fu))
        self._stem_h_fu = stem_h_fu
        self._stem_w_fu = stem_w_fu
        self._dot_r_fu = dot_r_fu
        self.update()

    def _fu_to_px(self, slot_x: float, dx_fu: float, dy_fu: float) -> Tuple[float, float]:
        """מרכז בסיס התג (תחתית הקו) בפיקסלים ביחס לווידג'ט."""
        cx_px = self._ox + (self._bbox_center_x_fu + slot_x + dx_fu) * self._px_per_fu
        top_px = self._oy - self._bbox_top_fu * self._px_per_fu
        base_y_px = top_px - dy_fu * self._px_per_fu
        return cx_px, base_y_px

    def _tag_hit_indices(self, mx: float, my: float) -> Optional[int]:
        hit_r = max(12.0, self._stem_w_fu * self._px_per_fu * 1.5)
        best: Optional[int] = None
        best_d = hit_r + 1.0
        for i, t in enumerate(self._tags_fu[: self._tag_count]):
            slot = self._slot_x_fu[i] if i < len(self._slot_x_fu) else 0.0
            cx, by = self._fu_to_px(slot, t.dx_fu, t.dy_fu)
            mid_y = by - (self._stem_h_fu * 0.5 + self._dot_r_fu) * self._px_per_fu
            d = math.hypot(mx - cx, my - mid_y)
            if d < best_d and d <= hit_r:
                best_d = d
                best = i
        return best

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        p.fillRect(self.rect(), QBrush(QColor(255, 255, 255)))
        if self._glyph_qimage is not None:
            p.drawImage(self._ox, self._oy, self._glyph_qimage)
        pen_line = QPen(QColor(30, 30, 30), max(1, int(round(self._stem_w_fu * self._px_per_fu))))
        pen_line.setCapStyle(Qt.RoundCap)
        p.setPen(pen_line)
        p.setBrush(QBrush(QColor(30, 30, 30)))
        for i, t in enumerate(self._tags_fu[: self._tag_count]):
            slot = self._slot_x_fu[i] if i < len(self._slot_x_fu) else 0.0
            cx, base_y = self._fu_to_px(slot, t.dx_fu, t.dy_fu)
            half_w = max(1.0, self._stem_w_fu * self._px_per_fu * 0.5)
            top_y = base_y - self._stem_h_fu * self._px_per_fu
            p.fillRect(
                int(round(cx - half_w)),
                int(round(top_y)),
                int(round(half_w * 2)),
                int(round(self._stem_h_fu * self._px_per_fu)),
                QColor(30, 30, 30),
            )
            dot_r_px = self._dot_r_fu * self._px_per_fu
            cy_dot = top_y - dot_r_px
            p.setPen(Qt.NoPen)
            p.setBrush(QBrush(QColor(30, 30, 30)))
            p.drawEllipse(
                int(round(cx - dot_r_px)),
                int(round(cy_dot - dot_r_px)),
                int(round(dot_r_px * 2)),
                int(round(dot_r_px * 2)),
            )
            p.setPen(pen_line)

    def mousePressEvent(self, e) -> None:
        if e.button() == Qt.LeftButton:
            idx = self._tag_hit_indices(e.x(), e.y())
            self._drag_idx = idx
            self._last_mouse = e.pos()
            if idx is not None:
                self.tagDragStarted.emit()

    def mouseMoveEvent(self, e) -> None:
        if self._drag_idx is not None and (e.buttons() & Qt.LeftButton):
            if self._last_mouse is not None:
                dx_px = e.x() - self._last_mouse.x()
                dy_px = e.y() - self._last_mouse.y()
                t = self._tags_fu[self._drag_idx]
                t.dx_fu += dx_px / self._px_per_fu
                t.dy_fu -= dy_px / self._px_per_fu
                self.update()
                self.tagDragged.emit()
            self._last_mouse = e.pos()
        else:
            self._last_mouse = e.pos()

    def mouseReleaseEvent(self, e) -> None:
        if e.button() == Qt.LeftButton:
            self._drag_idx = None
            self._last_mouse = None


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("עורך תגין לגופנים עבריים")
        self._font_path: Optional[str] = None
        self._ttfont: Optional[TTFont] = None
        self._ft_face: Optional[freetype.Face] = None
        self._upem: int = 1000
        self._ascender: int = 800
        self._settings_path: Optional[str] = None
        self._by_cp: Dict[int, LetterSettings] = {}
        self._current_cp: Optional[int] = None
        self._undo: List[Dict[str, Any]] = []
        self._redo: List[Dict[str, Any]] = []
        self._undo_suspend = 0

        self._letters_list = QListWidget()
        self._letters_list.setMinimumWidth(160)
        for cp in THREE_TAGINIM_CP:
            QListWidgetItem(f"שלושה — {_cp_label(cp)}", self._letters_list)
        for cp in ONE_TAG_CP:
            QListWidgetItem(f"אחד — {_cp_label(cp)}", self._letters_list)
        self._letters_list.currentRowChanged.connect(self._on_letter_row)

        self._canvas = TaginimEditorCanvas()
        self._canvas.tagDragStarted.connect(self._push_undo)
        self._canvas.tagDragged.connect(self._on_tag_dragged)

        self._slider_height = self._make_slider(5, 40, 15, "%")
        self._slider_line = self._make_slider(5, 80, 20, "%×10")
        self._slider_dot = self._make_slider(10, 80, 30, "%×10")
        self._slider_spacing = self._make_slider(2, 25, 8, "%")

        self._slider_height.valueChanged.connect(self._on_sliders_changed)
        self._slider_line.valueChanged.connect(self._on_sliders_changed)
        self._slider_dot.valueChanged.connect(self._on_sliders_changed)
        self._slider_spacing.valueChanged.connect(self._on_sliders_changed)

        for s in (self._slider_height, self._slider_line, self._slider_dot, self._slider_spacing):
            s.sliderPressed.connect(self._push_undo)

        settings_box = QGroupBox("הגדרות תג")
        form = QFormLayout()
        form.addRow("גובה התג (יחס לגובה האות):", self._slider_height)
        form.addRow("עובי הקו (יחס לרוחב האות):", self._slider_line)
        form.addRow("קוטר הנקודה (יחס לגובה האות):", self._slider_dot)
        form.addRow("מרווח בין תגין (שלושה):", self._slider_spacing)
        settings_box.setLayout(form)

        self._btn_open = QPushButton("פתח גופן…")
        self._btn_open.clicked.connect(self._open_font)
        self._btn_explorer_search = QPushButton("חיפוש גופנים ב־Explorer…")
        self._btn_explorer_search.setToolTip(
            "פותח חיפוש Windows (אופציונלי). לבחירת קובץ השתמש ב־«פתח גופן»."
        )
        self._btn_explorer_search.clicked.connect(self._explorer_font_search)
        self._btn_save = QPushButton("שמור גופן חדש")
        self._btn_save.clicked.connect(self._save_font)
        self._btn_save.setEnabled(False)

        self._preview_label = QLabel("")
        self._preview_label.setWordWrap(True)
        self._preview_label.setMinimumHeight(48)
        self._preview_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)

        right_panel = QWidget()
        rv = QVBoxLayout(right_panel)
        rv.addWidget(self._btn_open)
        rv.addWidget(self._btn_explorer_search)
        rv.addWidget(self._btn_save)
        rv.addWidget(settings_box)
        rv.addWidget(QLabel("תצוגה מקדימה אחרי שמירה:"))
        rv.addWidget(self._preview_label)
        rv.addStretch()

        center_wrap = QWidget()
        cv = QVBoxLayout(center_wrap)
        cv.addWidget(QLabel("עורך האות (גרור תגין)"))
        cv.addWidget(self._canvas, alignment=Qt.AlignCenter)
        cv.addStretch()

        # ב־RTL הווידג'ט הראשון ב־splitter יושב בקצה הימני — סדר: הגדרות, עורך, רשימת אותיות.
        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(right_panel)
        splitter.addWidget(center_wrap)
        splitter.addWidget(self._letters_list)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        splitter.setStretchFactor(2, 0)

        central = QWidget()
        lay = QHBoxLayout(central)
        lay.addWidget(splitter)
        self.setCentralWidget(central)

        undo_act = QAction("בטל", self)
        undo_act.setShortcut(QKeySequence.Undo)
        undo_act.triggered.connect(self._undo_action)
        self.addAction(undo_act)
        redo_act = QAction("בצע שוב", self)
        redo_act.setShortcut(QKeySequence.Redo)
        redo_act.triggered.connect(self._redo_action)
        self.addAction(redo_act)

        self._init_default_letter_settings()
        self._letters_list.setCurrentRow(0)

    def _make_slider(self, lo: int, hi: int, default_pct: int, suffix: str) -> QSlider:
        s = QSlider(Qt.Horizontal)
        s.setRange(lo, hi)
        s.setValue(default_pct)
        s.setProperty("suffix", suffix)
        return s

    def _init_default_letter_settings(self) -> None:
        for cp in THREE_TAGINIM_CP:
            ls = LetterSettings(codepoint=cp, tag_count=3)
            ls.ensure_tags()
            for t in ls.tags:
                t.dx_fu = 0.0
                t.dy_fu = 0.0
            self._by_cp[cp] = ls
        for cp in ONE_TAG_CP:
            ls = LetterSettings(codepoint=cp, tag_count=1)
            ls.ensure_tags()
            self._by_cp[cp] = ls

    def _glyph_name(self, cp: int) -> Optional[str]:
        if self._ttfont is None:
            return None
        cmap = self._ttfont.getBestCmap()
        if cmap is None or cp not in cmap:
            return None
        gid = cmap[cp]
        return self._ttfont.getGlyphName(gid)

    def _glyph_bounds_fu(self, gname: str) -> Optional[Tuple[float, float, float, float]]:
        if self._ttfont is None:
            return None
        gs = self._ttfont.getGlyphSet()
        if gname not in gs:
            return None
        b = gs[gname].bounds
        if b is None:
            return None
        return float(b[0]), float(b[1]), float(b[2]), float(b[3])

    def _explorer_font_search(self) -> None:
        if sys.platform != "win32":
            return
        ok = launch_windows_font_search(use_system_fonts_folder=False)
        if not ok:
            QMessageBox.warning(
                self,
                "לא נפתח",
                "לא ניתן לפתוח את חיפוש Windows. נסה לפתוח גופן דרך «פתח גופן…».",
            )

    def _open_font(self) -> None:
        start_dir = default_font_open_dir()
        # הדיאלוג המובנה של Windows לעיתים לא מציג קבצים ב־C:\Windows\Fonts (תיקיית מעטפת).
        # דיאלוג Qt רושם את התיקייה דרך מערכת הקבצים ומציג את ה־ttf/otf כרגיל.
        fd_opts = QFileDialog.Options()
        fd_opts |= QFileDialog.DontUseNativeDialog
        path, _ = QFileDialog.getOpenFileName(
            self,
            "בחר קובץ גופן",
            start_dir,
            "גופנים (*.ttf *.otf *.ttc *.TTF *.OTF *.TTC);;כל הקבצים (*.*)",
            options=fd_opts,
        )
        if not path:
            return
        try:
            font = TTFont(path, fontNumber=0)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", f"לא ניתן לטעון גופן:\n{e}")
            return
        if "glyf" not in font:
            QMessageBox.warning(
                self,
                "לא נתמך",
                "גופן זה ללא טבלת glyf (למשל CFF בלבד). נדרש גופן עם מתארי TrueType.",
            )
            font.close()
            return
        if self._ttfont is not None:
            self._ttfont.close()
        self._ttfont = font
        self._font_path = path
        self._upem = int(font["head"].unitsPerEm)
        hhea = font.get("hhea")
        self._ascender = int(hhea.ascender) if hhea is not None else int(round(self._upem * 0.8))
        try:
            self._ft_face = freetype.Face(path)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", f"freetype לא טען את הקובץ:\n{e}")
            return
        self._settings_path = path + ".taginim.json"
        self._load_settings_file()
        self._btn_save.setEnabled(True)
        self._refresh_letter_ui()

    def _load_settings_file(self) -> None:
        if not self._settings_path or not os.path.isfile(self._settings_path):
            self._init_default_letter_settings()
            return
        try:
            with open(self._settings_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            self._init_default_letter_settings()
            return
        letters = data.get("letters", [])
        if not letters:
            self._init_default_letter_settings()
            return
        self._by_cp.clear()
        for item in letters:
            ls = LetterSettings.from_json(item)
            self._by_cp[ls.codepoint] = ls
        for cp in list(THREE_TAGINIM_CP) + list(ONE_TAG_CP):
            if cp not in self._by_cp:
                self._by_cp[cp] = LetterSettings(
                    codepoint=cp,
                    tag_count=3 if cp in THREE_TAGINIM_CP else 1,
                )
                self._by_cp[cp].ensure_tags()

    def _save_settings_file(self) -> None:
        if not self._settings_path:
            return
        letters = [self._by_cp[cp].to_json() for cp in list(THREE_TAGINIM_CP) + list(ONE_TAG_CP)]
        payload = {"version": 1, "font_path": self._font_path, "letters": letters}
        with open(self._settings_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _current_letter_settings(self) -> Optional[LetterSettings]:
        if self._current_cp is None:
            return None
        return self._by_cp.get(self._current_cp)

    def _on_letter_row(self, row: int) -> None:
        if row < 0:
            return
        n_three = len(THREE_TAGINIM_CP)
        if row < n_three:
            cp = THREE_TAGINIM_CP[row]
        else:
            cp = ONE_TAG_CP[row - n_three]
        self._current_cp = cp
        self._refresh_letter_ui()

    def _snapshot_all(self) -> Dict[str, Any]:
        return {str(cp): self._by_cp[cp].to_json() for cp in self._by_cp}

    def _restore_all(self, snap: Dict[str, Any]) -> None:
        self._by_cp.clear()
        for k, v in snap.items():
            ls = LetterSettings.from_json(v)
            self._by_cp[ls.codepoint] = ls
        self._refresh_letter_ui()

    def _push_undo(self) -> None:
        if self._undo_suspend > 0:
            return
        self._undo.append(self._snapshot_all())
        self._redo.clear()
        if len(self._undo) > 80:
            self._undo.pop(0)

    def _undo_action(self) -> None:
        if not self._undo:
            return
        cur = self._snapshot_all()
        prev = self._undo.pop()
        self._redo.append(cur)
        self._restore_all(prev)
        self._save_settings_file()

    def _redo_action(self) -> None:
        if not self._redo:
            return
        cur = self._snapshot_all()
        nxt = self._redo.pop()
        self._undo.append(cur)
        self._restore_all(nxt)
        self._save_settings_file()

    def _on_tag_dragged(self) -> None:
        self._save_settings_file()

    def _slot_offsets_fu(self, ls: LetterSettings, ink_w: float) -> List[float]:
        spacing = ls.spacing_frac * ink_w
        if ls.tag_count == 3:
            return [(i - 1) * spacing for i in range(3)]
        return [0.0]

    def _slider_values_to_letter(self, ls: LetterSettings) -> None:
        ls.height_frac = self._slider_height.value() / 100.0
        ls.line_width_frac = self._slider_line.value() / 1000.0
        ls.dot_frac = self._slider_dot.value() / 1000.0
        ls.spacing_frac = self._slider_spacing.value() / 100.0

    def _letter_to_sliders(self, ls: LetterSettings) -> None:
        self._undo_suspend += 1
        try:
            self._slider_height.setValue(int(round(ls.height_frac * 100)))
            self._slider_line.setValue(int(round(ls.line_width_frac * 1000)))
            self._slider_dot.setValue(int(round(ls.dot_frac * 1000)))
            self._slider_spacing.setValue(int(round(ls.spacing_frac * 100)))
        finally:
            self._undo_suspend -= 1

    def _on_sliders_changed(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        self._slider_values_to_letter(ls)
        self._update_canvas_geometry()
        self._save_settings_file()

    def _ink_height_fu(self, ls: LetterSettings) -> float:
        gname = self._glyph_name(ls.codepoint)
        if gname:
            b = self._glyph_bounds_fu(gname)
            if b:
                return max(1.0, b[3] - b[1])
        return float(self._ascender)

    def _ink_width_fu(self, ls: LetterSettings) -> float:
        gname = self._glyph_name(ls.codepoint)
        if gname:
            b = self._glyph_bounds_fu(gname)
            if b:
                return max(1.0, b[2] - b[0])
        return float(self._upem * 0.6)

    def _refresh_letter_ui(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        self._letter_to_sliders(ls)
        self._render_glyph_preview()
        self._update_canvas_geometry()

    def _render_glyph_preview(self) -> None:
        if self._ft_face is None or self._current_cp is None:
            return
        ch = chr(self._current_cp)
        face = self._ft_face
        face.set_pixel_sizes(0, 280)
        face.load_char(ch, freetype.FT_LOAD_RENDER)
        bitmap = face.glyph.bitmap
        w, h = bitmap.width, bitmap.rows
        if w == 0 or h == 0:
            img = Image.new("L", (80, 80), 255)
        else:
            img = Image.frombytes("L", (w, h), bytes(bitmap.buffer))
        img_rgb = Image.new("RGB", (w, h), (255, 255, 255))
        img_rgb.paste((0, 0, 0), mask=img)
        qimg = ImageQt.ImageQt(img_rgb)
        left = face.glyph.bitmap_left
        top = face.glyph.bitmap_top
        upem = float(self._upem)
        asc = float(self._ascender)
        px_per_fu = h / asc if asc > 0 else 1.0
        gname = self._glyph_name(self._current_cp)
        bbox_cx = upem * 0.35
        bbox_top = asc
        if gname:
            b = self._glyph_bounds_fu(gname)
            if b:
                bbox_cx = (b[0] + b[2]) * 0.5
                bbox_top = b[3]
        ox = int((400 - w) // 2 - left)
        oy = int(320 - top)
        self._canvas.set_render_state(qimg, ox, oy, px_per_fu, bbox_cx, bbox_top)

    def _update_canvas_geometry(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        ls.ensure_tags()
        ink_h = self._ink_height_fu(ls)
        ink_w = self._ink_width_fu(ls)
        stem_h = max(30.0, ls.height_frac * ink_h)
        stem_w = max(8.0, ls.line_width_frac * ink_w * 0.5)
        dot_r = max(10.0, ls.dot_frac * ink_h * 0.5)
        slots = self._slot_offsets_fu(ls, ink_w)
        self._canvas.set_geometry(ls.tag_count, ls.tags, slots, stem_h, stem_w * 2, dot_r)

    def _save_font(self) -> None:
        if self._ttfont is None or not self._font_path:
            return
        self._save_settings_file()
        out_dir = os.path.dirname(self._font_path)
        base = os.path.splitext(os.path.basename(self._font_path))[0]
        out_path = os.path.join(out_dir, f"{base}_taginim.ttf")
        # תמיד מטעינים מקובץ המקור מחדש כדי שלא יושמו תגין פעמיים בשמירות חוזרות.
        font = TTFont(self._font_path, fontNumber=0)
        if "glyf" not in font:
            font.close()
            QMessageBox.warning(self, "שגיאה", "אין טבלת glyf.")
            return
        try:
            glyph_set = font.getGlyphSet()
            for cp in list(THREE_TAGINIM_CP) + list(ONE_TAG_CP):
                ls = self._by_cp.get(cp)
                if ls is None:
                    continue
                gname = None
                cmap = font.getBestCmap()
                if cmap and cp in cmap:
                    gname = font.getGlyphName(cmap[cp])
                if not gname or gname not in glyph_set:
                    continue
                self._embed_taginim_in_glyph(font, glyph_set, gname, ls)
            font.save(out_path)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", f"שמירה נכשלה:\n{e}")
            return
        finally:
            font.close()
        QMessageBox.information(self, "נשמר", f"הגופן נשמר בהצלחה:\n{out_path}")
        self._set_preview_font(out_path)

    def _embed_taginim_in_glyph(
        self,
        font: TTFont,
        glyph_set: Any,
        gname: str,
        ls: LetterSettings,
    ) -> None:
        ls.ensure_tags()
        upem = float(font["head"].unitsPerEm)
        hhea = font.get("hhea")
        _asc = float(hhea.ascender) if hhea is not None else upem * 0.8
        b = glyph_set[gname].bounds
        if b is None:
            y_max = _asc
            cx = upem * 0.35
            ink_h = _asc
            ink_w = upem * 0.5
        else:
            x0, y0, x1, y1 = map(float, b)
            cx = (x0 + x1) * 0.5
            y_max = y1
            ink_h = max(1.0, y1 - y0)
            ink_w = max(1.0, x1 - x0)
        stem_h = max(30.0, ls.height_frac * ink_h)
        half_w = max(10.0, ls.line_width_frac * ink_w * 0.5)
        dot_r = max(12.0, ls.dot_frac * ink_h * 0.5)
        spacing = ls.spacing_frac * ink_w

        rec = DecomposingRecordingPen(glyph_set)
        glyph_set[gname].draw(rec)
        pen = TTGlyphPen(glyph_set)
        rec.replay(pen)

        for i, t in enumerate(ls.tags[: ls.tag_count]):
            if ls.tag_count == 3:
                base_dx = (i - 1) * spacing
            else:
                base_dx = 0.0
            tcx = cx + base_dx + t.dx_fu
            y_stem_bottom = y_max + t.dy_fu
            y_stem_top = y_stem_bottom + stem_h
            _add_rect_stem(pen, tcx, y_stem_bottom, y_stem_top, half_w)
            cy_dot = y_stem_top + dot_r
            _add_circle_contour(pen, tcx, cy_dot, dot_r)

        new_g = pen.glyph()
        font["glyf"][gname] = new_g
        if "hmtx" in font:
            adv, _ = font["hmtx"][gname]
            ng = font["glyf"][gname]
            lsb = int(getattr(ng, "xMin", 0))
            font["hmtx"][gname] = (adv, lsb)

    def _set_preview_font(self, ttf_path: str) -> None:
        f = QFont()
        fid = QFont.addApplicationFont(ttf_path)
        if fid < 0:
            self._preview_label.setText(PREVIEW_TEXT)
            return
        fam = QFont.applicationFontFamilies(fid)
        if not fam:
            self._preview_label.setText(PREVIEW_TEXT)
            return
        f.setFamily(fam[0])
        f.setPointSize(22)
        self._preview_label.setFont(f)
        self._preview_label.setText(PREVIEW_TEXT)


def main() -> None:
    app = QApplication(sys.argv)
    app.setLayoutDirection(Qt.RightToLeft)
    w = MainWindow()
    w.resize(1000, 520)
    w.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
