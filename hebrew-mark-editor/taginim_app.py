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
import subprocess
import sys
import traceback
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

import freetype
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from PIL import Image

from windows_font_dirs import (
    default_font_open_dir,
    default_taginim_export_directory,
    is_windows_font_install_directory,
    launch_windows_font_search,
)

from PyQt5.QtCore import QPoint, Qt, pyqtSignal
from PyQt5.QtGui import QBrush, QColor, QFont, QImage, QKeySequence, QPainter, QPen
from PyQt5.QtWidgets import (
    QAction,
    QApplication,
    QCheckBox,
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


def _pil_rgb_to_qimage(pil_rgb: Image.Image) -> QImage:
    """המרה בטוחה ל־QImage בלי ImageQt (נמנעת קריסות ב־Python חדש / שילובי גרסאות)."""
    if pil_rgb.mode != "RGB":
        pil_rgb = pil_rgb.convert("RGB")
    w, h = pil_rgb.size
    if w <= 0 or h <= 0:
        pil_rgb = Image.new("RGB", (1, 1), (255, 255, 255))
        w, h = 1, 1
    stride = w * 3
    data = pil_rgb.tobytes("raw", "RGB")
    q = QImage(data, w, h, stride, QImage.Format_RGB888)
    return q.copy()


THREE_TAGINIM_CP: Tuple[int, ...] = (0x05E9, 0x05E2, 0x05D8, 0x05E0, 0x05D6, 0x05D2, 0x05E6)
ONE_TAG_CP: Tuple[int, ...] = (0x05D1, 0x05D3, 0x05E7, 0x05D7, 0x05D9, 0x05D4)


def _cmap_cp_to_glyph_name(font: TTFont, cp: int) -> Optional[str]:
    """getBestCmap מחזיר שם גליף (str), לא GID — לא לקרוא getGlyphName על המחרוזת."""
    cmap = font.getBestCmap()
    if cmap is None or cp not in cmap:
        return None
    val = cmap[cp]
    if isinstance(val, str):
        return val
    if isinstance(val, int):
        try:
            return font.getGlyphName(val)
        except Exception:
            return None
    return None


def _glyph_bounds_from_font(font: TTFont, gname: str) -> Optional[Tuple[float, float, float, float]]:
    """bbox ביחידות גופן; _TTGlyphGlyf בגרסאות חדשות ללא .bounds — נופלים ל-BoundsPen."""
    gs = font.getGlyphSet()
    if gname not in gs:
        return None
    glyph = gs[gname]
    b = getattr(glyph, "bounds", None)
    if b is not None:
        return float(b[0]), float(b[1]), float(b[2]), float(b[3])
    pen = BoundsPen(gs)
    try:
        glyph.draw(pen)
    except Exception:
        return None
    bb = pen.bounds
    if bb is None:
        return None
    return float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])


def _suffix_export_font_name_table(font: TTFont) -> None:
    """מבדיל את קובץ הייצוא בשם — אחרת InDesign/Windows עלולים לטעון את הגופן המקורי מהמטמון."""
    nt = font.get("name")
    if nt is None:
        return
    fam_suffix = " Taginim"
    for rec in nt.names:
        if rec.nameID not in (1, 3, 4, 16, 18, 21):
            continue
        try:
            t = rec.toUnicode()
        except Exception:
            continue
        if "Taginim" in t:
            continue
        new_t = t + fam_suffix
        try:
            enc = rec.getEncoding()
        except Exception:
            enc = "utf_16_be" if rec.platformID == 3 else "latin-1"
        enc_norm = enc.replace("-", "_").lower()
        try:
            if "utf_16" in enc_norm:
                rec.string = new_t.encode("utf-16-be")
            else:
                rec.string = new_t.encode(enc)
        except Exception:
            try:
                rec.string = new_t.encode("utf-16-be")
            except Exception:
                pass
    for rec in nt.names:
        if rec.nameID != 6:
            continue
        try:
            t = rec.toUnicode().strip()
        except Exception:
            continue
        if "-Taginim" in t or t.endswith("Taginim"):
            continue
        base = "".join(c for c in t if c.isalnum() or c in "-_") or "Font"
        ps = (base + "-Taginim")[:63]
        try:
            rec.string = ps.encode("latin-1")
        except Exception:
            rec.string = ps.encode("ascii", errors="replace")


PREVIEW_TEXT = "שמע ישראל ה אלהינו ה אחד"


def _reveal_file_in_folder(file_path: str) -> None:
    """פותח סייר קבצים על התיקייה ומסמן את הקובץ (ווינדוס: Explorer /select)."""
    path = os.path.normpath(os.path.abspath(file_path))
    folder = os.path.dirname(path)
    if sys.platform == "win32":
        try:
            subprocess.run(["explorer", "/select,", path], check=False)
        except OSError:
            try:
                os.startfile(folder)  # type: ignore[attr-defined]
            except OSError:
                pass
    elif sys.platform == "darwin":
        subprocess.run(["open", "-R", path], check=False)
    else:
        subprocess.run(["xdg-open", folder], check=False)


def _shaatnez_preset_path() -> str:
    d = os.path.join(os.path.expanduser("~"), ".taginim_editor")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "shaatnez_preset.json")


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
    """תג אמצעי בשלושה: גבוה יותר מהצדדים ביחס (למשל 0.12 = +12% גובה קו)."""
    middle_boost_frac: float = 0.12
    """הזזת כל חבילת התגין יחד (יחידות גופן)."""
    group_dx_fu: float = 0.0
    group_dy_fu: float = 0.0
    """מכפיל על גודל התגין (קו, נקודה, מרווח)."""
    package_scale: float = 1.0
    """אם כבוי — לא מוסיפים contours לאות זו בקובץ ה־_taginim (רק תצוגה בעורך)."""
    embed_in_font: bool = False
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
            "middle_boost_frac": self.middle_boost_frac,
            "group_dx_fu": self.group_dx_fu,
            "group_dy_fu": self.group_dy_fu,
            "package_scale": self.package_scale,
            "embed_in_font": self.embed_in_font,
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
            middle_boost_frac=float(d.get("middle_boost_frac", 0.12)),
            group_dx_fu=float(d.get("group_dx_fu", 0.0)),
            group_dy_fu=float(d.get("group_dy_fu", 0.0)),
            package_scale=float(d.get("package_scale", 1.0)),
            embed_in_font=bool(d.get("embed_in_font", True)),
            tags=tags,
        )
        ls.ensure_tags()
        # מיגרציה מגרסה ישנה: היסטים per-tag → חבילה אחת (לפני שדות group_* ב־JSON)
        legacy = "group_dx_fu" not in d
        if ls.tag_count == 3 and len(ls.tags) == 3 and legacy:
            if any(abs(ls.tags[i].dx_fu) > 1e-9 or abs(ls.tags[i].dy_fu) > 1e-9 for i in range(3)):
                ls.group_dx_fu = sum(t.dx_fu for t in ls.tags) / 3.0
                ls.group_dy_fu = sum(t.dy_fu for t in ls.tags) / 3.0
                for t in ls.tags:
                    t.dx_fu = 0.0
                    t.dy_fu = 0.0
        elif ls.tag_count == 1 and len(ls.tags) >= 1 and legacy:
            ls.group_dx_fu = ls.tags[0].dx_fu
            ls.group_dy_fu = ls.tags[0].dy_fu
            ls.tags[0].dx_fu = 0.0
            ls.tags[0].dy_fu = 0.0
        return ls


class TaginimEditorCanvas(QWidget):
    """תצוגת אות + תגין; שלושה תגין = חבילה אחת לגרירה, אמצעי גבוה יותר."""

    tagDragStarted = pyqtSignal()
    tagDragged = pyqtSignal()

    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self.setFixedSize(400, 400)
        self.setMouseTracking(True)
        self._glyph_qimage: Optional[Any] = None
        self._ox: int = 0
        self._oy: int = 0
        self._px_per_fu_x: float = 1.0
        self._px_per_fu_y: float = 1.0
        self._bbox_center_x_fu: float = 0.0
        self._tag_count: int = 1
        self._group_dx_fu: float = 0.0
        self._group_dy_fu: float = 0.0
        self._stem_h_list_fu: List[float] = [100.0]
        self._stem_w_fu: float = 25.0
        self._dot_r_fu: float = 20.0
        self._slot_x_fu: List[float] = []
        self._drag_package: bool = False
        self._last_mouse: Optional[QPoint] = None
        self._drag_delta_cb: Optional[Callable[[float, float], None]] = None

    def set_drag_delta_callback(self, cb: Optional[Callable[[float, float], None]]) -> None:
        self._drag_delta_cb = cb

    def set_render_state(
        self,
        qimage: Any,
        ox: int,
        oy: int,
        px_per_fu_x: float,
        px_per_fu_y: float,
        bbox_center_x_fu: float,
    ) -> None:
        self._glyph_qimage = qimage
        self._ox = ox
        self._oy = oy
        self._px_per_fu_x = max(px_per_fu_x, 1e-6)
        self._px_per_fu_y = max(px_per_fu_y, 1e-6)
        self._bbox_center_x_fu = bbox_center_x_fu
        self.update()

    def set_geometry(
        self,
        tag_count: int,
        group_dx_fu: float,
        group_dy_fu: float,
        slot_x_fu: List[float],
        stem_h_fu_list: List[float],
        stem_w_fu: float,
        dot_r_fu: float,
    ) -> None:
        self._tag_count = tag_count
        self._group_dx_fu = group_dx_fu
        self._group_dy_fu = group_dy_fu
        self._slot_x_fu = (
            slot_x_fu[:tag_count]
            if len(slot_x_fu) >= tag_count
            else slot_x_fu + [0.0] * (tag_count - len(slot_x_fu))
        )
        self._stem_h_list_fu = (
            stem_h_fu_list[:tag_count]
            if len(stem_h_fu_list) >= tag_count
            else stem_h_fu_list + [stem_h_fu_list[-1] if stem_h_fu_list else 100.0] * (tag_count - len(stem_h_fu_list))
        )
        self._stem_w_fu = stem_w_fu
        self._dot_r_fu = dot_r_fu
        self.update()

    def _fu_to_px(self, slot_x: float) -> Tuple[float, float]:
        """בסיס התג בפיקסלים (שפת התחתית של הקו מול האות), תואם ל־y_stem_bottom בהטמעה.

        oy הוא קצה עליון הביטמאפ; מיפוי לינארי: קו y=y1 (ראש תיבת הדיו) יושב על oy.
        נקודה ב־y = y1 + group_dy → מסך: oy + (y1 - (y1+dy))*sy = oy - dy*sy.
        כך נמנעים מאי־התאמה בין bitmap_top לבין y1*sy בגופנים עם hinting / bbox.
        """
        cx_px = self._ox + (self._bbox_center_x_fu + slot_x) * self._px_per_fu_x
        base_y_px = self._oy - self._group_dy_fu * self._px_per_fu_y
        return cx_px, base_y_px

    def _hit_package(self, mx: float, my: float) -> bool:
        hit_pad = max(14.0, self._stem_w_fu * self._px_per_fu_x * 2.0)
        for i in range(self._tag_count):
            slot = self._slot_x_fu[i] if i < len(self._slot_x_fu) else 0.0
            slot_x = slot + self._group_dx_fu
            cx, base_y = self._fu_to_px(slot_x)
            stem_h = self._stem_h_list_fu[i] if i < len(self._stem_h_list_fu) else self._stem_h_list_fu[0]
            half_w = max(2.0, self._stem_w_fu * self._px_per_fu_x * 0.5)
            top_y = base_y - stem_h * self._px_per_fu_y
            dot_r_px = self._dot_r_fu * self._px_per_fu_y
            # מלבן גס סביב קו+נקודה
            left = cx - half_w - hit_pad * 0.3
            right = cx + half_w + hit_pad * 0.3
            bottom = base_y + hit_pad * 0.2
            top = top_y - dot_r_px * 2 - hit_pad * 0.3
            if left <= mx <= right and top <= my <= bottom:
                return True
        return False

    def paintEvent(self, event) -> None:
        p = QPainter(self)
        p.fillRect(self.rect(), QBrush(QColor(255, 255, 255)))
        if self._glyph_qimage is not None:
            p.drawImage(self._ox, self._oy, self._glyph_qimage)
        pen_line = QPen(
            QColor(30, 30, 30),
            max(1, int(round(self._stem_w_fu * self._px_per_fu_x))),
        )
        pen_line.setCapStyle(Qt.RoundCap)
        p.setPen(pen_line)
        p.setBrush(QBrush(QColor(30, 30, 30)))
        for i in range(self._tag_count):
            slot = self._slot_x_fu[i] if i < len(self._slot_x_fu) else 0.0
            slot_x = slot + self._group_dx_fu
            cx, base_y = self._fu_to_px(slot_x)
            stem_h = self._stem_h_list_fu[i] if i < len(self._stem_h_list_fu) else self._stem_h_list_fu[0]
            half_w = max(1.0, self._stem_w_fu * self._px_per_fu_x * 0.5)
            top_y = base_y - stem_h * self._px_per_fu_y
            p.fillRect(
                int(round(cx - half_w)),
                int(round(top_y)),
                int(round(half_w * 2)),
                int(round(stem_h * self._px_per_fu_y)),
                QColor(30, 30, 30),
            )
            dot_r_px = self._dot_r_fu * self._px_per_fu_y
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
            self._drag_package = self._hit_package(float(e.x()), float(e.y()))
            self._last_mouse = e.pos()
            if self._drag_package:
                self.tagDragStarted.emit()

    def mouseMoveEvent(self, e) -> None:
        if self._drag_package and (e.buttons() & Qt.LeftButton):
            if self._last_mouse is not None and self._drag_delta_cb is not None:
                dx_px = e.x() - self._last_mouse.x()
                dy_px = e.y() - self._last_mouse.y()
                ddx = dx_px / self._px_per_fu_x
                ddy = -dy_px / self._px_per_fu_y
                self._drag_delta_cb(ddx, ddy)
                self.tagDragged.emit()
            self._last_mouse = e.pos()
        else:
            self._last_mouse = e.pos()

    def mouseReleaseEvent(self, e) -> None:
        if e.button() == Qt.LeftButton:
            self._drag_package = False
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
        self._canvas.set_drag_delta_callback(self._on_canvas_drag_delta)
        self._canvas.tagDragStarted.connect(self._push_undo)
        self._canvas.tagDragged.connect(self._on_tag_dragged)

        self._slider_height = self._make_slider(5, 40, 15, "%")
        self._slider_line = self._make_slider(5, 80, 20, "%×10")
        self._slider_dot = self._make_slider(10, 80, 30, "%×10")
        self._slider_spacing = self._make_slider(2, 25, 8, "%")
        self._slider_middle_boost = self._make_slider(0, 35, 12, "%/100")
        self._slider_pkg_scale = self._make_slider(50, 200, 100, "%/100")
        self._slider_gdx = self._make_slider(-2000, 2000, 0, "fu")
        self._slider_gdy = self._make_slider(-2000, 2000, 0, "fu")

        self._slider_height.valueChanged.connect(self._on_sliders_changed)
        self._slider_line.valueChanged.connect(self._on_sliders_changed)
        self._slider_dot.valueChanged.connect(self._on_sliders_changed)
        self._slider_spacing.valueChanged.connect(self._on_sliders_changed)
        self._slider_middle_boost.valueChanged.connect(self._on_sliders_changed)
        self._slider_pkg_scale.valueChanged.connect(self._on_sliders_changed)
        self._slider_gdx.valueChanged.connect(self._on_sliders_changed)
        self._slider_gdy.valueChanged.connect(self._on_sliders_changed)

        for s in (
            self._slider_height,
            self._slider_line,
            self._slider_dot,
            self._slider_spacing,
            self._slider_middle_boost,
            self._slider_pkg_scale,
            self._slider_gdx,
            self._slider_gdy,
        ):
            s.sliderPressed.connect(self._push_undo)

        self._chk_embed_in_font = QCheckBox("להטמיע תגין לאות זו בקובץ הגופן בעת «שמור גופן חדש»")
        self._chk_embed_in_font.setToolTip(
            "כבוי: התגין מוצג רק בעורך — האות לא תשתנה בקובץ ה־_taginim. "
            "סמן רק את האותיות שבאמת רוצים לשמור עם תגין."
        )
        self._chk_embed_in_font.pressed.connect(self._push_undo)
        self._chk_embed_in_font.stateChanged.connect(self._on_embed_in_font_changed)

        settings_box = QGroupBox("הגדרות תג")
        form = QFormLayout()
        form.addRow(self._chk_embed_in_font)
        form.addRow("גובה התג (יחס לגובה האות):", self._slider_height)
        form.addRow("עודף גובה תג אמצעי (שלושה):", self._slider_middle_boost)
        form.addRow("קנה מידה לחבילת תגין:", self._slider_pkg_scale)
        form.addRow("עובי הקו (יחס לרוחב האות):", self._slider_line)
        form.addRow("קוטר הנקודה (יחס לגובה האות):", self._slider_dot)
        form.addRow("מרווח בין תגין (שלושה):", self._slider_spacing)
        form.addRow("היסט חבילה אופקי (יחידות גופן):", self._slider_gdx)
        form.addRow("היסט חבילה אנכי:", self._slider_gdy)
        settings_box.setLayout(form)

        preset_box = QGroupBox("תבנית שעטנז״גץ (לכל הגופנים)")
        pv = QVBoxLayout()
        self._btn_preset_save = QPushButton("שמור תבנית מהאות הנוכחית…")
        self._btn_preset_save.setToolTip("שומר גודל, מיקום, עובי וכו׳ — להחלה על כל אות שעטנז״גץ בגופן חדש.")
        self._btn_preset_save.clicked.connect(self._save_shaatnez_preset)
        self._btn_preset_apply = QPushButton("החל תבנית על כל שעטנז״גץ")
        self._btn_preset_apply.clicked.connect(self._apply_shaatnez_preset)
        pv.addWidget(self._btn_preset_save)
        pv.addWidget(self._btn_preset_apply)
        preset_box.setLayout(pv)

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
        rv.addWidget(preset_box)
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
        return _cmap_cp_to_glyph_name(self._ttfont, cp)

    def _glyph_bounds_fu(self, gname: str) -> Optional[Tuple[float, float, float, float]]:
        if self._ttfont is None:
            return None
        return _glyph_bounds_from_font(self._ttfont, gname)

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
        try:
            # אותו אינדקס כמו ב־TTFont (חשוב ל־TTC)
            ft_face = freetype.Face(path, index=0)
        except Exception as e:
            font.close()
            QMessageBox.critical(self, "שגיאה", f"freetype לא טען את הקובץ:\n{e}")
            return
        if self._ttfont is not None:
            self._ttfont.close()
        self._ttfont = font
        self._ft_face = ft_face
        self._font_path = path
        self._upem = int(font["head"].unitsPerEm)
        hhea = font.get("hhea")
        self._ascender = int(hhea.ascender) if hhea is not None else int(round(self._upem * 0.8))
        self._settings_path = path + ".taginim.json"
        self._load_settings_file()
        self._btn_save.setEnabled(True)
        try:
            self._refresh_letter_ui()
        except Exception as e:
            QMessageBox.critical(
                self,
                "שגיאה אחרי טעינת הגופן",
                "הגופן נטען אך הממשק נכשל. פרטים טכניים:\n\n"
                f"{e}\n\n"
                f"{traceback.format_exc()}",
            )

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

    def _on_canvas_drag_delta(self, ddx: float, ddy: float) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        ls.group_dx_fu += ddx
        ls.group_dy_fu += ddy
        self._undo_suspend += 1
        try:
            self._slider_gdx.setValue(int(max(-2000, min(2000, round(ls.group_dx_fu)))))
            self._slider_gdy.setValue(int(max(-2000, min(2000, round(ls.group_dy_fu)))))
        finally:
            self._undo_suspend -= 1
        self._update_canvas_geometry()
        self._save_settings_file()

    def _save_shaatnez_preset(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        if ls.tag_count != 3:
            QMessageBox.information(
                self,
                "תבנית שעטנז״גץ",
                "בחר אות משורת «שלושה תגין» (שעטנז״גץ) כדי לשמור תבנית.",
            )
            return
        payload = {
            "version": 2,
            "height_frac": ls.height_frac,
            "line_width_frac": ls.line_width_frac,
            "dot_frac": ls.dot_frac,
            "spacing_frac": ls.spacing_frac,
            "middle_boost_frac": ls.middle_boost_frac,
            "package_scale": ls.package_scale,
            "group_dx_fu": ls.group_dx_fu,
            "group_dy_fu": ls.group_dy_fu,
        }
        path = _shaatnez_preset_path()
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except OSError as e:
            QMessageBox.critical(self, "שגיאה", f"לא ניתן לשמור תבנית:\n{e}")
            return
        QMessageBox.information(self, "נשמר", f"התבנית נשמרה:\n{path}")

    def _apply_shaatnez_preset(self) -> None:
        path = _shaatnez_preset_path()
        if not os.path.isfile(path):
            QMessageBox.warning(
                self,
                "אין תבנית",
                "עדיין לא נשמרה תבנית. בחר אות משעטנז״גץ, כוון, ולחץ «שמור תבנית מהאות הנוכחית».",
            )
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", f"לא ניתן לטעון תבנית:\n{e}")
            return
        keys = (
            "height_frac",
            "line_width_frac",
            "dot_frac",
            "spacing_frac",
            "middle_boost_frac",
            "package_scale",
            "group_dx_fu",
            "group_dy_fu",
        )
        self._push_undo()
        for cp in THREE_TAGINIM_CP:
            ls = self._by_cp.get(cp)
            if ls is None:
                continue
            for k in keys:
                if k in data:
                    setattr(ls, k, float(data[k]))
        self._save_settings_file()
        self._refresh_letter_ui()
        QMessageBox.information(self, "הוחל", "ההגדרות מהתבנית הוחלו על כל שבע אותיות שעטנז״גץ.")

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
        ls.middle_boost_frac = self._slider_middle_boost.value() / 100.0
        ls.package_scale = max(0.25, min(3.0, self._slider_pkg_scale.value() / 100.0))
        ls.group_dx_fu = float(self._slider_gdx.value())
        ls.group_dy_fu = float(self._slider_gdy.value())

    def _letter_to_sliders(self, ls: LetterSettings) -> None:
        self._undo_suspend += 1
        try:
            self._slider_height.setValue(int(round(ls.height_frac * 100)))
            self._slider_line.setValue(int(round(ls.line_width_frac * 1000)))
            self._slider_dot.setValue(int(round(ls.dot_frac * 1000)))
            self._slider_spacing.setValue(int(round(ls.spacing_frac * 100)))
            self._slider_middle_boost.setValue(int(round(ls.middle_boost_frac * 100)))
            self._slider_pkg_scale.setValue(int(round(max(0.25, min(3.0, ls.package_scale)) * 100)))
            self._slider_gdx.setValue(int(max(-2000, min(2000, round(ls.group_dx_fu)))))
            self._slider_gdy.setValue(int(max(-2000, min(2000, round(ls.group_dy_fu)))))
        finally:
            self._undo_suspend -= 1

    def _on_sliders_changed(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        self._slider_values_to_letter(ls)
        self._update_canvas_geometry()
        self._save_settings_file()

    def _on_embed_in_font_changed(self, state: int) -> None:
        if self._undo_suspend:
            return
        ls = self._current_letter_settings()
        if ls is None:
            return
        ls.embed_in_font = state == Qt.Checked
        self._save_settings_file()

    def _sync_embed_checkbox(self, ls: LetterSettings) -> None:
        self._undo_suspend += 1
        try:
            self._chk_embed_in_font.setChecked(ls.embed_in_font)
        finally:
            self._undo_suspend -= 1

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
        self._sync_embed_checkbox(ls)
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
        bw, bh = int(bitmap.width), int(bitmap.rows)
        left = int(face.glyph.bitmap_left)
        top = int(face.glyph.bitmap_top)
        if bw <= 0 or bh <= 0:
            # גליף חסר / ריק — חייבים מימדים חיוביים (אחרת Image.new((0,0)) ו־QImage קורסים)
            bw, bh = 80, 80
            img = Image.new("L", (bw, bh), 255)
            left, top = 0, 40
        else:
            buf = bytes(bitmap.buffer)
            img = Image.frombytes("L", (bw, bh), buf)
        img_rgb = Image.new("RGB", (bw, bh), (255, 255, 255))
        img_rgb.paste((0, 0, 0), mask=img)
        qimg = _pil_rgb_to_qimage(img_rgb)
        w, h = bw, bh
        upem = float(self._upem)
        asc = float(self._ascender)
        gname = self._glyph_name(self._current_cp)
        bbox_cx = upem * 0.35
        px_per_fu_x = float(w) / asc if asc > 0 else 1.0
        px_per_fu_y = float(h) / asc if asc > 0 else 1.0
        if gname:
            b = self._glyph_bounds_fu(gname)
            if b:
                x0, y0, x1, y1 = map(float, b)
                bbox_cx = (x0 + x1) * 0.5
                ink_w = max(1.0, x1 - x0)
                ink_h = max(1.0, y1 - y0)
                # קריטי: מיפוי לפי תיבת הדיו של הגליף — לא ascender כללי (אחרת group_dy שגוי מול הטמעה)
                px_per_fu_x = float(w) / ink_w
                px_per_fu_y = float(h) / ink_h
        ox = int((400 - w) // 2 - left)
        oy = int(320 - top)
        self._canvas.set_render_state(qimg, ox, oy, px_per_fu_x, px_per_fu_y, bbox_cx)

    def _update_canvas_geometry(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        ls.ensure_tags()
        ink_h = self._ink_height_fu(ls)
        ink_w = self._ink_width_fu(ls)
        sc = max(0.25, min(3.0, ls.package_scale))
        stem_side = max(30.0, ls.height_frac * ink_h) * sc
        stem_w = max(8.0, ls.line_width_frac * ink_w * 0.5) * sc
        dot_r = max(10.0, ls.dot_frac * ink_h * 0.5) * sc
        slots = self._slot_offsets_fu(ls, ink_w * sc)
        if ls.tag_count == 3:
            stem_heights = [
                stem_side,
                stem_side * (1.0 + max(0.0, ls.middle_boost_frac)),
                stem_side,
            ]
        else:
            stem_heights = [stem_side]
        self._canvas.set_geometry(
            ls.tag_count,
            ls.group_dx_fu,
            ls.group_dy_fu,
            slots,
            stem_heights,
            stem_w * 2,
            dot_r,
        )

    def _save_font(self) -> None:
        if self._ttfont is None or not self._font_path:
            return
        self._save_settings_file()
        base = os.path.splitext(os.path.basename(self._font_path))[0]
        out_name = f"{base}_taginim.ttf"
        src_dir = os.path.dirname(self._font_path)
        export_note: Optional[str] = None
        if is_windows_font_install_directory(src_dir):
            out_dir = default_taginim_export_directory()
            out_path = os.path.join(out_dir, out_name)
            export_note = (
                "הגופן המקורי נטען מתיקיית הגופנים של Windows — שם אין הרשאת כתיבה. "
                f"הקובץ נשמר בתיקייה:\n{out_dir}\n\n"
                "להתקנה: לחיצה ימנית על הקובץ → התקנה למשתמש."
            )
        else:
            out_path = os.path.join(src_dir, out_name)
        # תמיד מטעינים מקובץ המקור מחדש כדי שלא יושמו תגין פעמיים בשמירות חוזרות.
        font = TTFont(self._font_path, fontNumber=0)
        if "glyf" not in font:
            font.close()
            QMessageBox.warning(self, "שגיאה", "אין טבלת glyf.")
            return
        all_cp = list(THREE_TAGINIM_CP) + list(ONE_TAG_CP)
        n_marked = sum(
            1 for cp in all_cp if self._by_cp.get(cp) is not None and self._by_cp[cp].embed_in_font
        )
        if n_marked == 0:
            font.close()
            QMessageBox.warning(
                self,
                "אין אותיות לשמירה",
                "לא סומנה אף אות ב־«להטמיע תגין לאות זו בקובץ הגופן».\n\n"
                "סמן רק את האותיות שרוצים שייכללו בקובץ ה־_taginim, ואז שמור שוב.",
            )
            return
        try:
            glyph_set = font.getGlyphSet()
            for cp in all_cp:
                ls = self._by_cp.get(cp)
                if ls is None or not ls.embed_in_font:
                    continue
                gname = _cmap_cp_to_glyph_name(font, cp)
                if not gname or gname not in glyph_set:
                    continue
                self._embed_taginim_in_glyph(font, glyph_set, gname, ls)
            _suffix_export_font_name_table(font)
            try:
                font.save(out_path)
            except PermissionError:
                fb = default_taginim_export_directory()
                alt = os.path.join(fb, out_name)
                font.save(alt)
                out_path = alt
                export_note = (
                    "אין הרשאת כתיבה לתיקיית המקור. "
                    f"הקובץ נשמר ב־\n{out_path}"
                )
        except Exception as e:
            QMessageBox.critical(
                self,
                "שגיאה",
                "שמירה נכשלה.\n\n"
                f"{type(e).__name__}: {e}\n\n"
                "אם זו שגיאת הרשאות — שמור את קובץ ה־TTF המקורי בתיקייה רגילה (למשל שולחן עבודה) "
                "ופתח משם, או התקן את הגופן המיוצא דרך לחיצה ימנית → התקנה למשתמש.",
            )
            return
        finally:
            font.close()
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Information)
        box.setWindowTitle("נשמר")
        box.setText("הגופן עם התגין נשמר.")
        info_extra = (export_note + "\n\n") if export_note else ""
        box.setInformativeText(
            f"{info_extra}"
            f"מיקום הקובץ:\n{out_path}\n\n"
            "כשהמקור בתיקייה רגילה — השמירה ליד קובץ המקור; "
            "מתיקיית גופני Windows — השמירה ל־Downloads / שולחן עבודה / מסמכים (לפי מה שקיים). "
            "שם הקובץ מסתיים ב־_taginim.ttf\n\n"
            "להתקנה בווינדוס: לחיצה ימנית על הקובץ → התקנה למשתמש.\n"
            "ב־InDesign: בחר גופן עם הסיומת Taginim ברשימת המשפחות."
        )
        btn_open = box.addButton("פתח תיקייה ב־Explorer", QMessageBox.ActionRole)
        btn_close = box.addButton("סגור", QMessageBox.RejectRole)
        box.setDefaultButton(btn_close)
        box.exec_()
        if box.clickedButton() == btn_open:
            _reveal_file_in_folder(out_path)
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
        b = _glyph_bounds_from_font(font, gname)
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
        sc = max(0.25, min(3.0, ls.package_scale))
        stem_side = max(30.0, ls.height_frac * ink_h) * sc
        half_w = max(10.0, ls.line_width_frac * ink_w * 0.5) * sc
        dot_r = max(12.0, ls.dot_frac * ink_h * 0.5) * sc
        spacing = ls.spacing_frac * ink_w * sc

        rec = DecomposingRecordingPen(glyph_set)
        glyph_set[gname].draw(rec)
        pen = TTGlyphPen(glyph_set)
        rec.replay(pen)

        for i in range(ls.tag_count):
            if ls.tag_count == 3:
                base_dx = (i - 1) * spacing
            else:
                base_dx = 0.0
            stem_hi = (
                stem_side * (1.0 + max(0.0, ls.middle_boost_frac))
                if ls.tag_count == 3 and i == 1
                else stem_side
            )
            tcx = cx + base_dx + ls.group_dx_fu
            y_stem_bottom = y_max + ls.group_dy_fu
            y_stem_top = y_stem_bottom + stem_hi
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
