#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עורך תגין לגופנים עבריים — PyQt5 + fonttools + freetype-py + Pillow.
מוסיף קווים אנכיים עם נקודה עגולה מעל אותיות נבחרות ושומר TTF חדש.
"""

from __future__ import annotations

import io
import json
import math
import os
import subprocess
import sys
import traceback
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Dict, List, Optional, Tuple

import freetype
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

from PIL import Image

from windows_font_dirs import (
    default_font_open_dir,
    default_taginim_export_directory,
    is_windows_font_install_directory,
    iter_windows_font_directories,
    launch_windows_font_search,
    tagin_save_candidate_paths,
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
    QLineEdit,
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


def _is_save_access_denied(err: BaseException) -> bool:
    """כשל כתיבה / קובץ נעול / הרשאות — ממשיכים לנתיב חלופי או דיאלוג שמירה."""
    if isinstance(err, PermissionError):
        return True
    if isinstance(err, OSError):
        if err.errno in (13, 1):  # EACCES / EPERM
            return True
        if getattr(err, "winerror", None) == 5:
            return True
    return False


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


# שעטנז״גץ + נון סופית וצדי סופית (אותו מספר תגין כמו נ״ץ רגילות ב־STaM)
THREE_TAGINIM_CP: Tuple[int, ...] = (
    0x05E9,
    0x05E2,
    0x05D8,
    0x05E0,
    0x05DF,
    0x05D6,
    0x05D2,
    0x05E6,
    0x05E5,
)
ONE_TAG_CP: Tuple[int, ...] = (0x05D1, 0x05D3, 0x05E7, 0x05D7, 0x05D9, 0x05D4)

# מקסימום תגין לאות (כולל 0 = ללא תגין)
MAX_TAGINIM_PER_LETTER = 9

SHIN_CP = 0x05E9
# InDesign / עריכה / ניקוד: שין כגליף מורכב (נקודה/דגוש) — חייבים הטמעה בכל הווריאנטים ב־cmap,
# אחרת המעבד בוחר גליף בלי תגין. FB2E/FB2F = שין+דגוש+נקודת שין/סין (לעיתים NFC).
SHIN_VARIANT_CPS: Tuple[int, ...] = (
    0xFB2C,
    0xFB2D,
    0xFB2E,
    0xFB2F,
    0xFB49,
)


def _shin_variant_glyph_names(font: TTFont) -> set[str]:
    """שמות גליף לכל וריאנטי שין שמופיעים ב־cmap (לזיהוי בהטמעה)."""
    out: set[str] = set()
    for cp in SHIN_VARIANT_CPS:
        g = _cmap_cp_to_glyph_name(font, cp)
        if g:
            out.add(g)
    return out


def _glyph_names_for_codepoint(font: TTFont, cp: int) -> List[str]:
    """כל שמות הגליף ב־cmap לאות (כולל וריאנטי שין) — ללא כפילויות."""
    seen: set[str] = set()
    out: List[str] = []
    gs = font.getGlyphSet()

    def add(code: int) -> None:
        gn = _cmap_cp_to_glyph_name(font, code)
        if gn and gn not in seen and gn in gs:
            seen.add(gn)
            out.append(gn)

    add(cp)
    if cp == SHIN_CP:
        for v in SHIN_VARIANT_CPS:
            add(v)
    return out


def _glyf_strip_last_contours(font: TTFont, gname: str, n_contours: int) -> bool:
    """מסיר את n_contours הקונטורים האחרונים מגליף פשוט (לא מורכב). כל תג = 2 קונטורים (גזע + מעגל)."""
    if n_contours <= 0:
        return True
    glyf = font["glyf"]
    if gname not in glyf:
        return False
    g = glyf[gname]
    nc = int(getattr(g, "numberOfContours", 0))
    if nc < 0:
        return False
    if nc < n_contours:
        return False
    keep = nc - n_contours
    if keep < 0:
        return False
    ends = list(g.endPtsOfContours)
    last_keep_idx = int(ends[keep - 1])
    # fontTools: חיתוך coordinates מחזיר list — חייבים GlyphCoordinates ל־compile/recalcBounds
    g.coordinates = GlyphCoordinates(g.coordinates[: last_keep_idx + 1])
    g.flags = g.flags[: last_keep_idx + 1]
    g.endPtsOfContours = ends[:keep]
    g.numberOfContours = keep
    return True


def _filename_looks_like_taginim_export(path: str) -> bool:
    base = os.path.splitext(os.path.basename(path))[0].lower()
    return "_taginim" in base


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


def _glyph_xy_points_for_band_search(font: TTFont, glyph_set: Any, gname: str) -> List[Tuple[float, float]]:
    """נקודות מתאר TTF (כולל רכיבים מורכבים) — לחישוב גג מקומי מעל כל תג."""
    try:
        g = font["glyf"][gname]
    except KeyError:
        return []
    try:
        coords, _end, _flags = g.getCoordinates(glyph_set)
    except Exception:
        return []
    return [(float(c[0]), float(c[1])) for c in coords]


def _max_y_in_vertical_band(
    pts: List[Tuple[float, float]],
    x_center: float,
    half_width: float,
    fallback_y: float,
) -> float:
    lo, hi = x_center - half_width, x_center + half_width
    ys = [y for x, y in pts if lo <= x <= hi]
    return max(ys) if ys else fallback_y


def _bundle_top_y_fu_for_taginim(
    pts: List[Tuple[float, float]],
    n_tags: int,
    cx: float,
    spacing: float,
    group_dx: float,
    ink_w: float,
    half_w: float,
    y_fallback: float,
) -> float:
    """גובה אחד לבסיס כל החבילה: מינימום גגות מקומיים בין עמודות התגין.

    כך נמנעים ממדרג אנכי (כל תג על גג שונה) וגם מטעמים/ניקוד גבוהים שדוחפים את כל החבילה למעלה.
    """
    if n_tags <= 0:
        return y_fallback
    if n_tags == 1 and len(pts) >= 4:
        tcx = cx + group_dx
        half_band = max(ink_w * 0.11, half_w * 2.5, 22.0)
        return _max_y_in_vertical_band(pts, tcx, half_band, y_fallback)
    if n_tags >= 2 and len(pts) >= 8:
        half_band = max(spacing * 0.5, ink_w * 0.09, half_w * 2.2, 24.0)
        mid = (n_tags - 1) / 2.0
        roofs = [
            _max_y_in_vertical_band(pts, cx + (i - mid) * spacing + group_dx, half_band, y_fallback)
            for i in range(n_tags)
        ]
        return min(roofs)
    return y_fallback


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


def _sync_font_vertical_metrics_to_glyf_extents(font: TTFont) -> None:
    """מעלה ascender / usWinAscent וכו׳ לפי הקצה האמיתי של כל הגליפים.

    תגין מעל הדיו נשברים אם המטריקות נשארות נמוכות — InDesign ומנועי שורה עלולים לחתוך
    או לא לצייר את החלק שמעל ה־ascender המוצהר.
    """
    try:
        gs = font.getGlyphSet()
    except Exception:
        return
    y_max = -1e9
    y_min = 1e9
    for gname in font.getGlyphOrder():
        try:
            glyph = gs[gname]
        except KeyError:
            continue
        pen = BoundsPen(gs)
        try:
            glyph.draw(pen)
        except Exception:
            continue
        bb = pen.bounds
        if bb is None:
            continue
        _, y0, _, y1 = bb
        y_max = max(y_max, float(y1))
        y_min = min(y_min, float(y0))
    if y_max < -1e8:
        return
    upem = float(font["head"].unitsPerEm)
    pad = int(max(40, round(upem * 0.05)))
    top = int(math.ceil(y_max + pad))
    bot = int(math.floor(y_min - pad))
    hhea = font.get("hhea")
    if hhea is not None:
        if top > int(hhea.ascender):
            hhea.ascender = top
        if bot < int(hhea.descender):
            hhea.descender = bot
    head = font.get("head")
    if head is not None:
        head.yMax = max(int(getattr(head, "yMax", 0)), top)
        head.yMin = min(int(getattr(head, "yMin", 0)), bot)
    os2 = font.get("OS/2")
    if os2 is not None and int(getattr(os2, "version", 0)) >= 1:
        if hasattr(os2, "usWinAscent") and top > int(os2.usWinAscent):
            os2.usWinAscent = top
        below = max(0.0, -y_min)
        wd = int(math.ceil(below + pad))
        if hasattr(os2, "usWinDescent") and wd > int(os2.usWinDescent):
            os2.usWinDescent = wd
    if os2 is not None and int(getattr(os2, "version", 0)) >= 4:
        if hasattr(os2, "sTypoAscender") and top > int(os2.sTypoAscender):
            os2.sTypoAscender = top
        if hasattr(os2, "sTypoDescender") and bot < int(os2.sTypoDescender):
            os2.sTypoDescender = bot


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


def _tagin_style_preset_path() -> str:
    d = os.path.join(os.path.expanduser("~"), ".taginim_editor")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "tagin_style_preset.json")


# שדות ויזואליים משותפים: שמירת סגנון בודד + תבנית שעטנז״גץ (ללא embed_in_font).
# היסט חבילה (group_dx_fu / group_dy_fu) לא כלול — נשמר כ־group_dx_frac / group_dy_frac יחסית לרוחב/גובה תיבת הדיו של האות,
# כדי שהחלה על אות אחרת לא תזיז את התגין לפי יחידות מוחלטות של האות המקורית.
TAGIN_STYLE_PRESET_KEYS: Tuple[str, ...] = (
    "height_frac",
    "line_width_frac",
    "dot_frac",
    "spacing_frac",
    "middle_boost_frac",
    "package_scale",
)


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
    """כמה תגין הוטמעו בשמירה האחרונה (לכל תג 2 קונטורים). לפני הטמעה חוזרת מוסרים אותם כדי למנוע כפל."""
    embedded_tag_pairs: int = 0
    tags: List[TagPosition] = field(default_factory=list)

    def ensure_tags(self) -> None:
        n = self.tag_count
        while len(self.tags) < n:
            self.tags.append(TagPosition())
        self.tags = self.tags[:n]
        if self.embedded_tag_pairs > self.tag_count:
            self.embedded_tag_pairs = self.tag_count

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
            "embedded_tag_pairs": self.embedded_tag_pairs,
            "tags": [{"dx_fu": t.dx_fu, "dy_fu": t.dy_fu} for t in self.tags],
        }

    @staticmethod
    def from_json(d: Dict[str, Any]) -> "LetterSettings":
        tags = [TagPosition(float(t["dx_fu"]), float(t["dy_fu"])) for t in d.get("tags", [])]
        tc_raw = int(d.get("tag_count", 1))
        ls = LetterSettings(
            codepoint=int(d["codepoint"]),
            tag_count=max(0, min(MAX_TAGINIM_PER_LETTER, tc_raw)),
            height_frac=float(d.get("height_frac", 0.15)),
            line_width_frac=float(d.get("line_width_frac", 0.02)),
            dot_frac=float(d.get("dot_frac", 0.03)),
            spacing_frac=float(d.get("spacing_frac", 0.08)),
            middle_boost_frac=float(d.get("middle_boost_frac", 0.12)),
            group_dx_fu=float(d.get("group_dx_fu", 0.0)),
            group_dy_fu=float(d.get("group_dy_fu", 0.0)),
            package_scale=float(d.get("package_scale", 1.0)),
            # חסר ב־JSON = לא להטמיע (אחרת כל שעטנז״גץ/בד״ח נשמרו בגופן בלי שסימנו במפורש)
            embed_in_font=bool(d.get("embed_in_font", False)),
            embedded_tag_pairs=max(
                0, min(MAX_TAGINIM_PER_LETTER, int(d.get("embedded_tag_pairs", 0)))
            ),
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


# גודל דפוס לתצוגת מ״מ ליד הסליידרים (משוער; ההטמעה נשארת ביחידות גופן)
REFERENCE_PT_FOR_MM_LABEL = 12.0


def _fu_to_mm_at_pt(fu: float, upem: int, pt: float = REFERENCE_PT_FOR_MM_LABEL) -> float:
    if upem <= 0:
        return 0.0
    return (fu / float(upem)) * pt * (25.4 / 72.0)


def _default_letter_for_cp(cp: int) -> LetterSettings:
    """אותיות חדשות / חסרות ב־JSON — אותם ערכי סליידר לכולן (אין קפיצות בין אותיות עד שמירה נפרדת)."""
    base = LetterSettings(
        codepoint=0,
        tag_count=1,
        height_frac=0.15,
        line_width_frac=0.02,
        dot_frac=0.03,
        spacing_frac=0.08,
        middle_boost_frac=0.12,
        group_dx_fu=0.0,
        group_dy_fu=0.0,
        package_scale=1.0,
        embed_in_font=False,
        embedded_tag_pairs=0,
    )
    n = 3 if cp in THREE_TAGINIM_CP else 1
    ls = replace(base, codepoint=cp, tag_count=n, tags=[])
    ls.ensure_tags()
    return ls


def _glyph_embed_job_list(
    font: TTFont,
    by_cp: Dict[int, LetterSettings],
    letter_cps: List[int],
) -> List[Tuple[str, LetterSettings]]:
    """רשימת (שם גליף, הגדרות) ללא כפילויות — כולל וריאנטי שין ל־InDesign."""
    cmap = font.getBestCmap() or {}
    gs = font.getGlyphSet()
    seen: set[str] = set()
    out: List[Tuple[str, LetterSettings]] = []

    def try_add(cp: int, ls: Optional[LetterSettings]) -> None:
        if ls is None or not ls.embed_in_font or ls.tag_count <= 0:
            return
        gname = _cmap_cp_to_glyph_name(font, cp)
        if not gname or gname not in gs:
            return
        if gname in seen:
            return
        seen.add(gname)
        out.append((gname, ls))

    for cp in letter_cps:
        try_add(cp, by_cp.get(cp))
    shin_ls = by_cp.get(SHIN_CP)
    if shin_ls is not None and shin_ls.embed_in_font:
        for vcp in SHIN_VARIANT_CPS:
            if vcp in cmap:
                try_add(vcp, shin_ls)
    return out


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
        # קצה שמאל של תיבת הדיו ביחידות גופן — חייבים בניכוי כדי ליישר תגין לביטמאפ (לא x=0)
        self._ink_x0_fu: float = 0.0
        self._bitmap_top_px: int = 0
        # y מקסימלי של תיבת הדיו ביחידות גופן (עיגון אנכי מול קו הבסיס)
        self._bbox_y_top_fu: float = 0.0
        self._tag_count: int = 1
        self._group_dx_fu: float = 0.0
        self._group_dy_fu: float = 0.0
        self._stem_h_list_fu: List[float] = [100.0]
        self._stem_w_fu: float = 25.0
        self._dot_r_fu: float = 20.0
        self._slot_x_fu: List[float] = []
        self._per_tag_roof_y_fu: Optional[List[float]] = None
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
        bitmap_top_px: int = 0,
        bbox_y_top_fu: float = 0.0,
        ink_x0_fu: float = 0.0,
    ) -> None:
        self._glyph_qimage = qimage
        self._ox = ox
        self._oy = oy
        self._px_per_fu_x = max(px_per_fu_x, 1e-6)
        self._px_per_fu_y = max(px_per_fu_y, 1e-6)
        self._bbox_center_x_fu = bbox_center_x_fu
        self._ink_x0_fu = float(ink_x0_fu)
        self._bitmap_top_px = int(bitmap_top_px)
        self._bbox_y_top_fu = float(bbox_y_top_fu)
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
        per_tag_roof_y_fu: Optional[List[float]] = None,
    ) -> None:
        self._tag_count = tag_count
        self._group_dx_fu = group_dx_fu
        self._group_dy_fu = group_dy_fu
        if per_tag_roof_y_fu is not None and len(per_tag_roof_y_fu) >= tag_count:
            self._per_tag_roof_y_fu = list(per_tag_roof_y_fu[:tag_count])
        else:
            self._per_tag_roof_y_fu = None
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

    def _fu_to_px(self, slot_x: float, tag_index: int = 0) -> Tuple[float, float]:
        """בסיס התג בפיקסלים (כמו y_stem_bottom בהטמעה: קצה תחתון של הקו על y=y1+dy).

        קו הבסיס בפיקסלים: oy + bitmap_top (FreeType). נקודה בגובה y ביחידות גופן:
        baseline_px - y * py. py מגיע מ־y_ppem/unitsPerEm — לא מ־h/ink_h (נוטה לשבור בגופנים עם bbox מול ביטמאפ).
        """
        x_abs_fu = self._bbox_center_x_fu + slot_x
        cx_px = self._ox + (x_abs_fu - self._ink_x0_fu) * self._px_per_fu_x
        baseline_px = float(self._oy + self._bitmap_top_px)
        if (
            self._per_tag_roof_y_fu is not None
            and 0 <= tag_index < len(self._per_tag_roof_y_fu)
        ):
            y_roof = float(self._per_tag_roof_y_fu[tag_index])
        else:
            y_roof = self._bbox_y_top_fu
        y_anchor_fu = y_roof + self._group_dy_fu
        base_y_px = baseline_px - y_anchor_fu * self._px_per_fu_y
        return cx_px, base_y_px

    def _hit_package(self, mx: float, my: float) -> bool:
        hit_pad = max(14.0, self._stem_w_fu * self._px_per_fu_x * 2.0)
        for i in range(self._tag_count):
            slot = self._slot_x_fu[i] if i < len(self._slot_x_fu) else 0.0
            slot_x = slot + self._group_dx_fu
            cx, base_y = self._fu_to_px(slot_x, i)
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
            cx, base_y = self._fu_to_px(slot_x, i)
            stem_h = self._stem_h_list_fu[i] if i < len(self._stem_h_list_fu) else self._stem_h_list_fu[0]
            half_w = max(1.0, self._stem_w_fu * self._px_per_fu_x * 0.5)
            top_y = base_y - stem_h * self._px_per_fu_y
            rw = max(1, int(round(half_w * 2)))
            rh = max(1, int(round(stem_h * self._px_per_fu_y)))
            p.fillRect(int(round(cx - half_w)), int(round(top_y)), rw, rh, QColor(30, 30, 30))
            dot_r_px = max(1.0, self._dot_r_fu * self._px_per_fu_y)
            cy_dot = top_y - dot_r_px
            dr = max(1, int(round(dot_r_px * 2)))
            p.setPen(Qt.NoPen)
            p.setBrush(QBrush(QColor(30, 30, 30)))
            p.drawEllipse(int(round(cx - dot_r_px)), int(round(cy_dot - dot_r_px)), dr, dr)
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
        self._ft_face_io: Optional[io.BytesIO] = None
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
            "הצ׳קבוקס משפיע רק על האות שבחרת ברשימה משמאל. "
            "עוברים לשין — מסמנים; עוברים לעיין — צריך לסמן שוב לעיין. "
            "ללא סימון: התגין רק בעורך, בלי לשנות את הגליף בקובץ."
        )
        self._chk_embed_in_font.pressed.connect(self._push_undo)
        self._chk_embed_in_font.stateChanged.connect(self._on_embed_in_font_changed)

        settings_box = QGroupBox("הגדרות תג")
        form = QFormLayout()
        form.addRow(self._chk_embed_in_font)
        self._lbl_embed_status = QLabel("")
        self._lbl_embed_status.setWordWrap(True)
        self._lbl_embed_status.setStyleSheet("color: #333; font-size: 11px;")
        form.addRow(self._lbl_embed_status)
        self._btn_add_tagin = QPushButton("הוסף תג…")
        self._btn_remove_tagin = QPushButton("הסר תג אחרון")
        self._btn_strip_baked = QPushButton("הסר תגין מוטמעים מהאות")
        self._btn_add_tagin.setToolTip(
            f"מוסיף תג נוסף לחבילה (עד {MAX_TAGINIM_PER_LETTER}). מרווחים נקבעים לפי סליידר המרווח."
        )
        self._btn_remove_tagin.setToolTip(
            "מקטין את מספר התגין. ב־0 — אין תגין על האות בעורך (ולא יוטבע בגופן)."
        )
        self._btn_strip_baked.setToolTip(
            "מוחק מהגליף בזיכרון את קונטורי התגין מהשמירה הקודמת (לפי מונה פנימי או לפי מספר התגין). "
            "אחרי פתיחת ‎*_taginim.ttf‎ כמקור — לפני שמירה חוזרת, כדי למנוע כפל תגין."
        )
        self._btn_add_tagin.clicked.connect(self._on_add_tagin)
        self._btn_remove_tagin.clicked.connect(self._on_remove_tagin)
        self._btn_strip_baked.clicked.connect(self._on_strip_baked_taginim)
        tag_btn_row = QWidget()
        tbr = QHBoxLayout(tag_btn_row)
        tbr.setContentsMargins(0, 0, 0, 0)
        tbr.addWidget(self._btn_add_tagin)
        tbr.addWidget(self._btn_remove_tagin)
        tbr.addWidget(self._btn_strip_baked)
        tbr.addStretch()
        form.addRow("חבילת תגין:", tag_btn_row)
        self._lbl_mm_hint = QLabel(
            f"ליד כל סליידר מוצגים ערכים מדויקים ומ״מ משוערים (הדפסה @{int(REFERENCE_PT_FOR_MM_LABEL)}pt, לפי UPEM ומידות האות הנוכחית)."
        )
        self._lbl_mm_hint.setWordWrap(True)
        self._lbl_mm_hint.setStyleSheet("color: #555; font-size: 11px;")
        form.addRow(self._lbl_mm_hint)
        self._lbl_slider_height = self._form_row_slider_metric(form, "גובה התג (יחס לגובה האות):", self._slider_height)
        self._lbl_slider_middle = self._form_row_slider_metric(
            form, "עודף גובה תג אמצעי (שלושה):", self._slider_middle_boost
        )
        self._lbl_slider_pkg = self._form_row_slider_metric(form, "קנה מידה לחבילת תגין:", self._slider_pkg_scale)
        self._lbl_slider_line = self._form_row_slider_metric(form, "עובי הקו (יחס לרוחב האות):", self._slider_line)
        self._lbl_slider_dot = self._form_row_slider_metric(form, "קוטר הנקודה (יחס לגובה האות):", self._slider_dot)
        self._lbl_slider_spacing = self._form_row_slider_metric(form, "מרווח בין תגין (שלושה):", self._slider_spacing)
        self._lbl_slider_gdx = self._form_row_slider_metric(
            form, "היסט חבילה אופקי (יחידות גופן):", self._slider_gdx
        )
        self._lbl_slider_gdy = self._form_row_slider_metric(form, "היסט חבילה אנכי:", self._slider_gdy)
        settings_box.setLayout(form)

        style_box = QGroupBox("סגנון תגין (העתקה בין אותיות)")
        sv = QVBoxLayout()
        self._btn_style_save = QPushButton("שמור סגנון מהאות הנוכחית…")
        self._btn_style_save.setToolTip(
            "שומר יחסי גודל (גובה תג, עובי, נקודה, מרווח, קנה מידה) ואת מיקום החבילה כיחס לרוחב/גובה האות — "
            "כך שהחלה על עין/טית וכו׳ לא מעתיקה יחידות גופן מוחלטות משין."
        )
        self._btn_style_save.clicked.connect(self._save_tagin_style_preset)
        self._btn_style_apply = QPushButton("החל סגנון על אות זו")
        self._btn_style_apply.setToolTip(
            "מחיל את הסגנון השמור על האות הנוכחית; היסט החבילה מחושב מחדש לפי תיבת הדיו של האות הזו."
        )
        self._btn_style_apply.clicked.connect(self._apply_tagin_style_to_current_letter)
        sv.addWidget(self._btn_style_save)
        sv.addWidget(self._btn_style_apply)
        style_box.setLayout(sv)

        preset_box = QGroupBox("תבנית שעטנז״גץ (לכל הגופנים)")
        pv = QVBoxLayout()
        self._btn_preset_save = QPushButton("שמור תבנית מהאות הנוכחית…")
        self._btn_preset_save.setToolTip(
            "כמו «שמור סגנון» אך לכל שבע אותות שעטנז״גץ: יחסים + מיקום חבילה יחסי לתיבת הדיו של האות שנבחרה."
        )
        self._btn_preset_save.clicked.connect(self._save_shaatnez_preset)
        self._btn_preset_apply = QPushButton("החל תבנית על כל שעטנז״גץ")
        self._btn_preset_apply.clicked.connect(self._apply_shaatnez_preset)
        pv.addWidget(self._btn_preset_save)
        pv.addWidget(self._btn_preset_apply)
        preset_box.setLayout(pv)

        self._line_font_query = QLineEdit()
        self._line_font_query.setPlaceholderText("חיפוש שם קובץ גופן (אופציונלי)…")
        self._line_font_query.setToolTip(
            "הקלידו חלק משם הקובץ (למשל Achenel) בלי סיומת.\n"
            "התאמה יחידה — הגופן נטען מיד.\n"
            "כמה התאמות — נפתח חלון קבצים על ההתאמה הראשונה.\n"
            "אין התאמה — נפתח דיאלוג רגיל לבחירת קובץ."
        )
        self._btn_open = QPushButton("פתח גופן…")
        self._btn_open.clicked.connect(self._open_font)
        self._line_font_query.returnPressed.connect(self._open_font)
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
        rv.addWidget(self._line_font_query)
        rv.addWidget(self._btn_open)
        rv.addWidget(self._btn_explorer_search)
        rv.addWidget(self._btn_save)
        rv.addWidget(settings_box)
        rv.addWidget(style_box)
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

    def _form_row_slider_metric(self, form: QFormLayout, title: str, slider: QSlider) -> QLabel:
        lbl = QLabel("")
        lbl.setMinimumWidth(200)
        lbl.setLayoutDirection(Qt.LeftToRight)
        lbl.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        lbl.setStyleSheet("color: #1a1a1a; font-size: 11px;")
        row = QWidget()
        hl = QHBoxLayout(row)
        hl.setContentsMargins(0, 0, 0, 0)
        hl.addWidget(slider, 1)
        hl.addWidget(lbl, 0)
        form.addRow(title, row)
        return lbl

    def _init_default_letter_settings(self) -> None:
        self._by_cp.clear()
        for cp in list(THREE_TAGINIM_CP) + list(ONE_TAG_CP):
            self._by_cp[cp] = _default_letter_for_cp(cp)
        self._update_embed_indicators()

    def _glyph_name(self, cp: int) -> Optional[str]:
        if self._ttfont is None:
            return None
        return _cmap_cp_to_glyph_name(self._ttfont, cp)

    def _glyph_bounds_fu(self, gname: str) -> Optional[Tuple[float, float, float, float]]:
        if self._ttfont is None:
            return None
        return _glyph_bounds_from_font(self._ttfont, gname)

    def _ink_dimensions_for_cp(self, cp: int) -> Tuple[float, float]:
        """רוחב וגובה תיבת דיו של האות ביחידות גופן (לחישוב היסט יחסי בסגנון)."""
        if self._ttfont is None:
            return max(1.0, float(self._upem) * 0.6), max(1.0, float(self._ascender))
        gn = self._glyph_name(cp)
        if gn:
            b = self._glyph_bounds_fu(gn)
            if b:
                x0, y0, x1, y1 = map(float, b)
                return max(1.0, x1 - x0), max(1.0, y1 - y0)
        return max(1.0, float(self._upem) * 0.6), max(1.0, float(self._ascender))

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

    def _candidate_font_search_dirs(self) -> List[str]:
        """תיקיות לחיפוש לפי שם קובץ (גופני מערכת + תיקיות נפוצות למשתמש)."""
        out: List[str] = []
        seen: set[str] = set()

        def add(p: str) -> None:
            if not p:
                return
            try:
                ap = os.path.normcase(os.path.abspath(p))
            except OSError:
                return
            if ap in seen or not os.path.isdir(p):
                return
            seen.add(ap)
            out.append(p)

        try:
            add(default_font_open_dir())
        except OSError:
            pass
        if sys.platform == "win32":
            for d in iter_windows_font_directories():
                add(d)
        home = os.path.expanduser("~")
        for sub in (
            "Downloads",
            "הורדות",
            "Desktop",
            "שולחן עבודה",
            "Documents",
            "מסמכים",
        ):
            add(os.path.join(home, sub))
        return out

    def _find_font_files_matching(self, needle: str) -> List[str]:
        """מחזיר נתיבים ממוינים לפי רלוונטיות: שם בסיס מדויק, התחלה, מכיל."""
        q = needle.strip().lower()
        for ext in (".ttf", ".otf", ".ttc"):
            if q.endswith(ext):
                q = q[: -len(ext)].strip()
                break
        if not q:
            return []
        exts = (".ttf", ".otf", ".ttc")
        ranked: List[Tuple[int, str]] = []
        for d in self._candidate_font_search_dirs():
            try:
                names = os.listdir(d)
            except OSError:
                continue
            for name in names:
                low = name.lower()
                if not low.endswith(exts):
                    continue
                full = os.path.join(d, name)
                if not os.path.isfile(full):
                    continue
                base = os.path.splitext(low)[0]
                if q == base:
                    ranked.append((0, full))
                elif base.startswith(q):
                    ranked.append((1, full))
                elif q in base:
                    ranked.append((2, full))
        ranked.sort(key=lambda x: (x[0], os.path.basename(x[1]).lower()))
        uniq: List[str] = []
        got: set[str] = set()
        for _, p in ranked:
            k = os.path.normcase(os.path.abspath(p))
            if k in got:
                continue
            got.add(k)
            uniq.append(p)
        return uniq

    def _load_font_from_path(self, path: str) -> bool:
        """טוען גופן מנתיב. מחזיר True אם הצליח."""
        if not path:
            return False
        try:
            font = TTFont(path, fontNumber=0)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", f"לא ניתן לטעון גופן:\n{e}")
            return False
        if "glyf" not in font:
            QMessageBox.warning(
                self,
                "לא נתמך",
                "גופן זה ללא טבלת glyf (למשל CFF בלבד). נדרש גופן עם מתארי TrueType.",
            )
            font.close()
            return False
        try:
            ft_face = freetype.Face(path, index=0)
        except Exception as e:
            font.close()
            QMessageBox.critical(self, "שגיאה", f"freetype לא טען את הקובץ:\n{e}")
            return False
        if self._ttfont is not None:
            self._ttfont.close()
        self._ttfont = font
        self._ft_face = ft_face
        self._ft_face_io = None
        self._font_path = path
        self._upem = int(font["head"].unitsPerEm)
        hhea = font.get("hhea")
        self._ascender = int(hhea.ascender) if hhea is not None else int(round(self._upem * 0.8))
        self._settings_path = path + ".taginim.json"
        had_settings_json = os.path.isfile(self._settings_path)
        self._load_settings_file()
        if had_settings_json and _filename_looks_like_taginim_export(path):
            touched = False
            for cp in list(THREE_TAGINIM_CP) + list(ONE_TAG_CP):
                ls = self._by_cp[cp]
                if ls.embed_in_font and ls.tag_count > 0 and ls.embedded_tag_pairs == 0:
                    ls.embedded_tag_pairs = ls.tag_count
                    touched = True
            if touched:
                self._save_settings_file()
        elif not had_settings_json and _filename_looks_like_taginim_export(path):
            QMessageBox.information(
                self,
                "גופן ייצוא ללא קובץ הגדרות",
                "נטען קובץ ששמו מרמז על ייצוא תגין (‎*_taginim‎) אך לא נמצא לצדו ‎.taginim.json‎.\n\n"
                "אם האותיות כבר כוללות תגין בקובץ — לפני שמירה חוזרת לחצו «הסר תגין מוטמעים מהאות» "
                "על כל אות רלוונטית, או טענו את קובץ המקור לפני הטמעת התגין.",
            )
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
        return True

    def _open_font(self) -> None:
        fd_opts = QFileDialog.Options()
        fd_opts |= QFileDialog.DontUseNativeDialog
        filt = "גופנים (*.ttf *.otf *.ttc *.TTF *.OTF *.TTC);;כל הקבצים (*.*)"

        needle = self._line_font_query.text().strip()
        matches = self._find_font_files_matching(needle) if needle else []

        if needle and len(matches) == 1:
            self._load_font_from_path(matches[0])
            return
        if needle and len(matches) > 1:
            start_path = matches[0]
            path, _ = QFileDialog.getOpenFileName(
                self,
                f"נמצאו {len(matches)} קבצים — בחרו קובץ",
                start_path,
                filt,
                options=fd_opts,
            )
            if path:
                self._load_font_from_path(path)
            return
        if needle and not matches:
            QMessageBox.information(
                self,
                "לא נמצא בשטח החיפוש",
                f"לא נמצא קובץ שמתאים ל־«{needle}» בתיקיות הגופנים והתיקיות הנפוצות.\n\n"
                "ייפתח דיאלוג לבחירת קובץ ידנית.",
            )

        start_dir = default_font_open_dir()
        path, _ = QFileDialog.getOpenFileName(
            self,
            "בחר קובץ גופן",
            start_dir,
            filt,
            options=fd_opts,
        )
        if path:
            self._load_font_from_path(path)

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
                self._by_cp[cp] = _default_letter_for_cp(cp)
        self._update_embed_indicators()

        file_ver = int(data.get("version", 1))
        # קבצי הגדרות ישנים: כש־embed_in_font חסר ב־JSON נטען True לכולן → שמירת גופן הטמיעה הכול.
        if file_ver < 2:
            tracked = [self._by_cp[cp] for cp in list(THREE_TAGINIM_CP) + list(ONE_TAG_CP)]
            if tracked and all(ls.embed_in_font for ls in tracked):
                for ls in tracked:
                    ls.embed_in_font = False
                self._save_settings_file()
                self._update_embed_indicators()

    def _save_settings_file(self) -> None:
        if not self._settings_path:
            return
        letters = [self._by_cp[cp].to_json() for cp in list(THREE_TAGINIM_CP) + list(ONE_TAG_CP)]
        payload = {"version": 2, "font_path": self._font_path, "letters": letters}
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
        self._update_slider_metric_labels()
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
        iw, ih = self._ink_dimensions_for_cp(ls.codepoint)
        payload = {
            "version": 4,
            "saved_from_cp": ls.codepoint,
            **{k: getattr(ls, k) for k in TAGIN_STYLE_PRESET_KEYS},
            "group_dx_frac": ls.group_dx_fu / max(iw, 1e-6),
            "group_dy_frac": ls.group_dy_fu / max(ih, 1e-6),
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
        self._push_undo()
        for cp in THREE_TAGINIM_CP:
            ls = self._by_cp.get(cp)
            if ls is None:
                continue
            self._apply_tagin_style_data_to_letter(ls, data)
        self._save_settings_file()
        self._refresh_letter_ui()
        QMessageBox.information(self, "הוחל", "ההגדרות מהתבנית הוחלו על כל שבע אותיות שעטנז״גץ.")

    def _apply_tagin_style_data_to_letter(self, ls: LetterSettings, data: Dict[str, Any]) -> None:
        for k in TAGIN_STYLE_PRESET_KEYS:
            if k in data:
                setattr(ls, k, float(data[k]))
        tw, th = self._ink_dimensions_for_cp(ls.codepoint)
        if "group_dx_frac" in data and "group_dy_frac" in data:
            dx_frac = float(data["group_dx_frac"])
            dy_frac = float(data["group_dy_frac"])
        else:
            ref_cp = data.get("saved_from_cp")
            if isinstance(ref_cp, int):
                rw, rh = self._ink_dimensions_for_cp(ref_cp)
            else:
                # תבניות ישנות בלי saved_from_cp — מניחים שה־FU נמדדו לעומת שין (אות ראשונה בשעטנז״גץ)
                rw, rh = self._ink_dimensions_for_cp(THREE_TAGINIM_CP[0])
            dx_frac = float(data.get("group_dx_fu", 0.0)) / max(rw, 1e-6)
            dy_frac = float(data.get("group_dy_fu", 0.0)) / max(rh, 1e-6)
        ls.group_dx_fu = dx_frac * tw
        ls.group_dy_fu = dy_frac * th
        ls.ensure_tags()
        for t in ls.tags:
            t.dx_fu = 0.0
            t.dy_fu = 0.0

    def _save_tagin_style_preset(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        self._slider_values_to_letter(ls)
        iw, ih = self._ink_dimensions_for_cp(ls.codepoint)
        payload = {
            "version": 4,
            "saved_from_cp": ls.codepoint,
            **{k: getattr(ls, k) for k in TAGIN_STYLE_PRESET_KEYS},
            "group_dx_frac": ls.group_dx_fu / max(iw, 1e-6),
            "group_dy_frac": ls.group_dy_fu / max(ih, 1e-6),
        }
        path = _tagin_style_preset_path()
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except OSError as e:
            QMessageBox.critical(self, "שגיאה", f"לא ניתן לשמור סגנון:\n{e}")
            return
        QMessageBox.information(
            self,
            "נשמר",
            f"סגנון התגין נשמר (מאות {_cp_label(ls.codepoint)}).\n\n{path}\n\n"
            "בחרו אות אחרת ברשימה ולחצו «החל סגנון על אות זו».",
        )

    def _apply_tagin_style_to_current_letter(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        path = _tagin_style_preset_path()
        if not os.path.isfile(path):
            QMessageBox.warning(
                self,
                "אין סגנון שמור",
                "עדיין לא נשמר סגנון. כווננו אות אחת (למשל שין), לחצו «שמור סגנון מהאות הנוכחית», "
                "ועברו לאות הבאה.",
            )
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", f"לא ניתן לטעון סגנון:\n{e}")
            return
        self._push_undo()
        self._apply_tagin_style_data_to_letter(ls, data)
        self._save_settings_file()
        self._refresh_letter_ui()
        ref = data.get("saved_from_cp")
        ref_txt = f" (מאות {_cp_label(int(ref))})" if isinstance(ref, int) else ""
        QMessageBox.information(
            self,
            "הוחל",
            f"הסגנון הוחל על {_cp_label(ls.codepoint)}{ref_txt}.\n"
            "מיקום החבילה מותאם לרוחב ולגובה של האות הנוכחית (יחסית לאות המקור). "
            "אם צריך — עדיין אפשר לגרור או לכוון את סליידרי ההיסט.",
        )

    def _slot_offsets_fu(self, ls: LetterSettings, ink_w: float) -> List[float]:
        spacing = ls.spacing_frac * ink_w
        n = ls.tag_count
        if n <= 0:
            return []
        if n == 1:
            return [0.0]
        mid = (n - 1) / 2.0
        return [(i - mid) * spacing for i in range(n)]

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
        # בזמן _letter_to_sliders (מעבר אות / רענון) setValue מפעיל valueChanged —
        # בלי החזרה כאן נכתבים ל־ls של האות הנוכחית ערכים מעורבבים (חלק מהאות הקודמת).
        if self._undo_suspend:
            return
        ls = self._current_letter_settings()
        if ls is None:
            return
        self._slider_values_to_letter(ls)
        self._update_canvas_geometry()
        self._save_settings_file()
        self._update_slider_metric_labels()

    def _on_embed_in_font_changed(self, state: int) -> None:
        if self._undo_suspend:
            return
        ls = self._current_letter_settings()
        if ls is None:
            return
        ls.embed_in_font = state == Qt.Checked
        self._save_settings_file()
        self._update_embed_indicators()

    def _update_embed_indicators(self) -> None:
        """רשימת אותיות + שורת סטטוס — כמה אותיות ייכנסו לקובץ בשמירה."""
        n_three = len(THREE_TAGINIM_CP)
        for i, cp in enumerate(THREE_TAGINIM_CP):
            ls = self._by_cp.get(cp)
            on = ls is not None and ls.embed_in_font
            suf = "  ● להטמעה" if on else ""
            self._letters_list.item(i).setText(f"שלושה — {_cp_label(cp)}{suf}")
        for j, cp in enumerate(ONE_TAG_CP):
            row = n_three + j
            ls = self._by_cp.get(cp)
            on = ls is not None and ls.embed_in_font
            suf = "  ● להטמעה" if on else ""
            self._letters_list.item(row).setText(f"אחד — {_cp_label(cp)}{suf}")
        ordered = list(THREE_TAGINIM_CP) + list(ONE_TAG_CP)
        marked = [cp for cp in ordered if self._by_cp.get(cp) is not None and self._by_cp[cp].embed_in_font]
        if not self._by_cp:
            self._lbl_embed_status.setText("")
        elif not marked:
            self._lbl_embed_status.setText(
                "בשמירה: לא יוטבע תגין באף גליף — סמנו «להטמיע» לכל אות שצריך בקובץ ה־_taginim."
            )
        else:
            chs = " ".join(chr(cp) for cp in marked)
            self._lbl_embed_status.setText(
                f"בשמירה יוטבע תגין רק על: {chs}  ({len(marked)} אותיות)"
            )

    def _sync_embed_checkbox(self, ls: LetterSettings) -> None:
        self._undo_suspend += 1
        try:
            self._chk_embed_in_font.setChecked(ls.embed_in_font)
        finally:
            self._undo_suspend -= 1

    def _sync_tagin_count_ui(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            self._btn_add_tagin.setEnabled(False)
            self._btn_remove_tagin.setEnabled(False)
            self._btn_strip_baked.setEnabled(False)
            self._slider_middle_boost.setEnabled(False)
            return
        n = ls.tag_count
        tt_ok = self._ttfont is not None
        self._btn_add_tagin.setEnabled(n < MAX_TAGINIM_PER_LETTER)
        self._btn_remove_tagin.setEnabled(n > 0)
        self._btn_strip_baked.setEnabled(tt_ok and n > 0)
        self._slider_middle_boost.setEnabled(n == 3)

    def _on_add_tagin(self) -> None:
        ls = self._current_letter_settings()
        if ls is None:
            return
        if ls.tag_count >= MAX_TAGINIM_PER_LETTER:
            QMessageBox.information(
                self,
                "מגבלה",
                f"ניתן להוסיף עד {MAX_TAGINIM_PER_LETTER} תגין לאות.",
            )
            return
        self._push_undo()
        ls.tag_count += 1
        ls.ensure_tags()
        self._save_settings_file()
        self._refresh_letter_ui()

    def _on_remove_tagin(self) -> None:
        ls = self._current_letter_settings()
        if ls is None or ls.tag_count <= 0:
            return
        self._push_undo()
        ls.tag_count -= 1
        ls.ensure_tags()
        self._save_settings_file()
        self._refresh_letter_ui()

    def _reload_ft_face_from_memory(self) -> None:
        """אחרי שינוי glyf ב־TTFont — טעינת freetype מזיכרון (הנתיב על הדיסק לא מתעדכן)."""
        if self._ttfont is None:
            return
        bio = io.BytesIO()
        self._ttfont.save(bio)
        bio.seek(0)
        self._ft_face_io = bio
        if self._ft_face is not None:
            try:
                self._ft_face.close()
            except Exception:
                pass
        self._ft_face = freetype.Face(bio, index=0)

    def _on_strip_baked_taginim(self) -> None:
        if self._ttfont is None or self._current_cp is None:
            return
        ls = self._by_cp.get(self._current_cp)
        if ls is None or ls.tag_count <= 0:
            return
        pairs = ls.embedded_tag_pairs if ls.embedded_tag_pairs > 0 else ls.tag_count
        n_strip = 2 * pairs
        if n_strip <= 0:
            return
        r = QMessageBox.question(
            self,
            "הסרת תגין מוטמעים",
            f"יוסרו {n_strip} קונטורים אחרונים מכל גליף של האות הנוכחית (לפי {pairs} תגין). "
            "המתאר המקורי לפני ההטמעה לא נשמר בעורך — לשחזור מלא צריך לטעון מחדש את קובץ הגופן הבסיסי.\n\n"
            "להמשיך?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if r != QMessageBox.Yes:
            return
        failed: List[str] = []
        for gname in _glyph_names_for_codepoint(self._ttfont, self._current_cp):
            if not _glyf_strip_last_contours(self._ttfont, gname, n_strip):
                failed.append(gname)
        if failed:
            QMessageBox.warning(
                self,
                "הסרה חלקית",
                "לא ניתן להסיר (גליף מורכב או אין מספיק קונטורים):\n"
                + ", ".join(failed[:14])
                + ("\n…" if len(failed) > 14 else ""),
            )
        ls.embedded_tag_pairs = 0
        self._save_settings_file()
        self._reload_ft_face_from_memory()
        self._refresh_letter_ui()

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

    def _fmt_mm_fu_line(self, fu: float) -> str:
        """מ״מ חיובי (גדלים פיזיים) + יחידות גופן."""
        mm = max(0.0, _fu_to_mm_at_pt(abs(fu), self._upem, REFERENCE_PT_FOR_MM_LABEL))
        return f"{mm:.2f} מ״מ · {abs(fu):.0f} FU"

    def _fmt_mm_fu_signed(self, fu: float) -> str:
        """היסטים יכולים להיות שליליים — מ״מ ו־FU עם סימן."""
        mm = _fu_to_mm_at_pt(fu, self._upem, REFERENCE_PT_FOR_MM_LABEL)
        return f"{mm:+.2f} מ״מ · {fu:+.0f} FU"

    def _update_slider_metric_labels(self) -> None:
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
        line_full_w = stem_w * 2.0
        dot_d = dot_r * 2.0
        spacing_fu = ls.spacing_frac * ink_w * sc

        h_pct = self._slider_height.value()
        self._lbl_slider_height.setText(f"{h_pct}% → {self._fmt_mm_fu_line(stem_side)}")

        mid_pct = self._slider_middle_boost.value()
        if ls.tag_count == 3:
            extra_mid = stem_side * max(0.0, ls.middle_boost_frac)
            self._lbl_slider_middle.setText(f"+{mid_pct}% → {self._fmt_mm_fu_line(extra_mid)}")
        else:
            self._lbl_slider_middle.setText("— (רק בדיוק 3 תגין)")

        pkg_v = self._slider_pkg_scale.value() / 100.0
        self._lbl_slider_pkg.setText(f"×{pkg_v:.2f} (קנה מידה; ללא מ״מ)")

        lw_k = self._slider_line.value()
        self._lbl_slider_line.setText(f"{lw_k / 10:.1f}‰ → {self._fmt_mm_fu_line(line_full_w)}")

        dot_k = self._slider_dot.value()
        self._lbl_slider_dot.setText(f"{dot_k / 10:.1f}‰ → {self._fmt_mm_fu_line(dot_d)}")

        sp_pct = self._slider_spacing.value()
        if ls.tag_count >= 2:
            self._lbl_slider_spacing.setText(f"{sp_pct}% → {self._fmt_mm_fu_line(spacing_fu)}")
        else:
            self._lbl_slider_spacing.setText("— (פחות משתי תגין)")

        self._lbl_slider_gdx.setText(self._fmt_mm_fu_signed(float(ls.group_dx_fu)))
        self._lbl_slider_gdy.setText(self._fmt_mm_fu_signed(float(ls.group_dy_fu)))

    def _refresh_letter_ui(self) -> None:
        self._update_embed_indicators()
        ls = self._current_letter_settings()
        if ls is None:
            self._sync_tagin_count_ui()
            return
        self._letter_to_sliders(ls)
        self._sync_embed_checkbox(ls)
        self._render_glyph_preview()
        self._update_canvas_geometry()
        self._update_slider_metric_labels()
        self._sync_tagin_count_ui()

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
        upem_ft = float(face.units_per_EM)
        y_ppem = float(getattr(face.size, "y_ppem", 0) or 0)
        x_ppem = float(getattr(face.size, "x_ppem", 0) or 0)
        if y_ppem <= 0:
            y_ppem = 280.0
        if x_ppem <= 0:
            x_ppem = y_ppem
        # אנכי: תמיד קנה מידה מהרינדור (PPEM/UPEM). h/ink_h שובר כש־bbox ≠ ביטמאפ (התגין נעלם).
        px_per_fu_y = y_ppem / max(upem_ft, 1.0)
        upem = float(self._upem)
        asc = float(self._ascender)
        gname = self._glyph_name(self._current_cp)
        bbox_cx = upem * 0.35
        bbox_y_top = asc
        px_per_fu_x = float(w) / asc if asc > 0 else (x_ppem / max(upem_ft, 1.0))
        ink_x0 = 0.0
        if gname:
            b = self._glyph_bounds_fu(gname)
            if b:
                x0, y0, x1, y1 = map(float, b)
                ink_x0 = x0
                bbox_cx = (x0 + x1) * 0.5
                bbox_y_top = y1
                ink_w = max(1.0, x1 - x0)
                # אופקי: יחס רוחב ביטמאפ לתיבת דיו — נשאר כדי ליישר מול הפיקסלים
                px_per_fu_x = float(w) / ink_w
        ox = int((400 - w) // 2 - left)
        oy = int(320 - top)
        self._canvas.set_render_state(
            qimg,
            ox,
            oy,
            px_per_fu_x,
            px_per_fu_y,
            bbox_cx,
            bitmap_top_px=top,
            bbox_y_top_fu=bbox_y_top,
            ink_x0_fu=ink_x0,
        )

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
        n = ls.tag_count
        if n == 0:
            stem_heights = []
        elif n == 3:
            stem_heights = [
                stem_side,
                stem_side * (1.0 + max(0.0, ls.middle_boost_frac)),
                stem_side,
            ]
        else:
            stem_heights = [stem_side] * n

        per_roof: Optional[List[float]] = None
        gname_ed = self._glyph_name(ls.codepoint)
        if n > 0 and gname_ed and self._ttfont is not None:
            bb = self._glyph_bounds_fu(gname_ed)
            if bb:
                x0b, _y0b, x1b, y1b = map(float, bb)
                cxb = (x0b + x1b) * 0.5
                yfb = y1b
                spacing_fu = ls.spacing_frac * ink_w * sc
                gs = self._ttfont.getGlyphSet()
                ptlist = _glyph_xy_points_for_band_search(self._ttfont, gs, gname_ed)
                yb = _bundle_top_y_fu_for_taginim(
                    ptlist,
                    n,
                    cxb,
                    spacing_fu,
                    ls.group_dx_fu,
                    ink_w * sc,
                    stem_w,
                    yfb,
                )
                per_roof = [yb] * n

        self._canvas.set_geometry(
            ls.tag_count,
            ls.group_dx_fu,
            ls.group_dy_fu,
            slots,
            stem_heights,
            stem_w * 2,
            dot_r,
            per_tag_roof_y_fu=per_roof,
        )

    def _record_embedded_pairs_after_save(self, all_cp: List[int]) -> None:
        """אחרי שמירת גופן מוצלחת — מעדכן כמה זוגות קונטורים (תגין) יוסרו בשמירה הבאה."""
        for cp in all_cp:
            ls = self._by_cp[cp]
            if ls.embed_in_font and ls.tag_count > 0:
                ls.embedded_tag_pairs = ls.tag_count

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
        # טעינה מחדש מהנתיב: לפני הטמעה מוסרים קונטורים לפי embedded_tag_pairs (מניעת כפל כשהמקור הוא ‎*_taginim‎).
        font = TTFont(self._font_path, fontNumber=0)
        if "glyf" not in font:
            font.close()
            QMessageBox.warning(self, "שגיאה", "אין טבלת glyf.")
            return
        all_cp = list(THREE_TAGINIM_CP) + list(ONE_TAG_CP)
        n_marked = sum(
            1
            for cp in all_cp
            if self._by_cp.get(cp) is not None
            and self._by_cp[cp].embed_in_font
            and self._by_cp[cp].tag_count > 0
        )
        if n_marked == 0:
            font.close()
            QMessageBox.warning(
                self,
                "אין אותיות לשמירה",
                "לא סומנה אף אות עם תגין לשמירה (צ׳קבוקס הטמעה + לפחות תג אחד).\n\n"
                "סמנו «להטמיע» וודאו שמספר התגין גדול מאפס, ואז שמור שוב.",
            )
            return
        try:
            glyph_set = font.getGlyphSet()
            for gname, ls in _glyph_embed_job_list(font, self._by_cp, all_cp):
                self._embed_taginim_in_glyph(font, glyph_set, gname, ls)
            _sync_font_vertical_metrics_to_glyf_extents(font)
            _suffix_export_font_name_table(font)

            candidates = tagin_save_candidate_paths(out_name, out_path)
            primary_target = candidates[0]
            saved_to: Optional[str] = None
            saved_via_dialog = False
            for cand in candidates:
                try:
                    par = os.path.dirname(cand)
                    if par and not os.path.isdir(par):
                        os.makedirs(par, exist_ok=True)
                    font.save(cand)
                    saved_to = cand
                    self._record_embedded_pairs_after_save(all_cp)
                    self._save_settings_file()
                    break
                except (PermissionError, OSError) as e:
                    if _is_save_access_denied(e):
                        continue
                    raise

            if saved_to is None:
                start_dir = default_taginim_export_directory()
                fd_opts = QFileDialog.Options()
                fd_opts |= QFileDialog.DontUseNativeDialog
                picked, _ = QFileDialog.getSaveFileName(
                    self,
                    "שמור גופן בשם",
                    os.path.join(start_dir, out_name),
                    "TrueType (*.ttf)",
                    options=fd_opts,
                )
                if not picked:
                    return
                if not picked.lower().endswith(".ttf"):
                    picked += ".ttf"
                try:
                    pdir = os.path.dirname(picked)
                    if pdir and not os.path.isdir(pdir):
                        os.makedirs(pdir, exist_ok=True)
                    font.save(picked)
                    saved_to = picked
                    saved_via_dialog = True
                    self._record_embedded_pairs_after_save(all_cp)
                    self._save_settings_file()
                    export_note = "נשמר לנתיב שבחרתם בדיאלוג."
                except (PermissionError, OSError) as e2:
                    QMessageBox.critical(
                        self,
                        "שגיאה",
                        "שמירה נכשלה גם אחרי בחירת נתיב.\n\n"
                        f"{type(e2).__name__}: {e2}\n\n"
                        "סגרו יישומים שעשויים לנעול את הקובץ (למשל תצוגה מקדימה של גופן), "
                        "או שמרו לשם קובץ אחר / תיקייה אחרת.",
                    )
                    return

            out_path = saved_to
            if not saved_via_dialog and os.path.normcase(os.path.abspath(saved_to)) != os.path.normcase(
                os.path.abspath(primary_target)
            ):
                export_note = (
                    "הנתיב הראשון לשמירה לא זמין לכתיבה (הרשאות, קובץ בשימוש או סנכרון תיקייה). "
                    f"הקובץ נשמר בפועל ב־\n{saved_to}\n\n"
                    "להתקנה: לחיצה ימנית על הקובץ → התקנה למשתמש."
                )
        except Exception as e:
            QMessageBox.critical(
                self,
                "שגיאה",
                "שמירה נכשלה.\n\n"
                f"{type(e).__name__}: {e}\n\n"
                "אם זו שגיאת הרשאות או קובץ נעול — נסו שוב אחרי סגירת תצוגת גופן / יישום שמשתמש בקובץ, "
                "או שמרו דרך הדיאלוג לתיקייה אחרת (למשל שולחן עבודה או "
                f"{os.path.join(os.path.expanduser('~'), '.taginim_editor', 'exports')}).",
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
            "ב־InDesign: בחרו במפורש את משפחת הגופן עם הסיומת «Taginim» (לא את הקובץ המקורי). "
            "סגירה והפעלה מחדש של InDesign אחרי התקנה עוזרת אם נטען גרסה ישנה מהמטמון.\n"
            "עברית: מומלץ מחבר פסקה «World-Ready» (או מסגרת עמוד) ו־RTL. "
            "אם עדיין בלי תגין: בטלו זמנית OpenType (ליגטורות / חלופות) לבדיקה.\n"
            "אם שין בלי תגין: הטמעה כוללת גם גליפי שין חלופיים (U+FB2C…FB2F, FB49 וכו׳) כשקיימים ב־cmap."
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
        if ls.embedded_tag_pairs > 0:
            n_strip = 2 * ls.embedded_tag_pairs
            _glyf_strip_last_contours(font, gname, n_strip)
        upem = float(font["head"].unitsPerEm)
        hhea = font.get("hhea")
        _asc = float(hhea.ascender) if hhea is not None else upem * 0.8
        gs_names = font.getGlyphSet()
        base_shin_gn = _cmap_cp_to_glyph_name(font, SHIN_CP)
        variant_names = _shin_variant_glyph_names(font)
        use_base_shin_geometry = (
            base_shin_gn is not None
            and gname != base_shin_gn
            and gname in variant_names
            and base_shin_gn in gs_names
        )
        geom_gn = base_shin_gn if use_base_shin_geometry else gname
        b = _glyph_bounds_from_font(font, geom_gn)
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

        pts = _glyph_xy_points_for_band_search(font, glyph_set, geom_gn)
        y_bundle = _bundle_top_y_fu_for_taginim(
            pts, ls.tag_count, cx, spacing, ls.group_dx_fu, ink_w, half_w, y_max
        )
        y_stem_bottom_all = y_bundle + ls.group_dy_fu

        rec = DecomposingRecordingPen(glyph_set)
        glyph_set[gname].draw(rec)
        pen = TTGlyphPen(glyph_set)
        rec.replay(pen)

        mid_i = (ls.tag_count - 1) / 2.0
        for i in range(ls.tag_count):
            base_dx = (i - mid_i) * spacing
            stem_hi = (
                stem_side * (1.0 + max(0.0, ls.middle_boost_frac))
                if ls.tag_count == 3 and i == 1
                else stem_side
            )
            tcx = cx + base_dx + ls.group_dx_fu
            y_stem_bottom = y_stem_bottom_all
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
