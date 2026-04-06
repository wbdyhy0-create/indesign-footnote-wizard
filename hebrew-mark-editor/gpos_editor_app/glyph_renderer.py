# -*- coding: utf-8 -*-
"""רינדור תצוגה מקדימה: FreeType + Pillow — אות + סימון לפי היסט בעיגון (יחידות גופן)."""

from __future__ import annotations

from io import BytesIO
from typing import TYPE_CHECKING, Optional, Tuple

import freetype

if TYPE_CHECKING:
    from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw

# ערכי ברירת מחדל לקנבס
CANVAS_W, CANVAS_H = 560, 420


def _select_unicode_charmap(face: freetype.Face) -> None:
    """Ensure get_char_index() uses the Unicode cmap (some fonts default to Symbol)."""
    try:
        face.select_charmap(freetype.FT_ENCODING_UNICODE)
    except Exception:
        # Best-effort: some faces may not expose select_charmap in older bindings
        try:
            face.charmap = face.get_charmap(freetype.FT_ENCODING_UNICODE)  # type: ignore[attr-defined]
        except Exception:
            pass


def _render_glyph_slot(
    face: freetype.Face, glyph_index: int, color: int = 0
) -> Tuple[Optional[object], int, int, int, int]:
    """מחזיר (PIL L mode image או None, left, top, width, height) במרחב פיקסלים."""
    face.load_glyph(glyph_index, freetype.FT_LOAD_RENDER)
    g = face.glyph
    bm = g.bitmap
    w, h = int(bm.width), int(bm.rows)
    if w <= 0 or h <= 0:
        return None, int(g.bitmap_left), int(g.bitmap_top), 0, 0
    buf = bytes(bm.buffer)
    img = Image.new("L", (w, h), 255)
    pix = img.load()
    for y in range(h):
        row = y * w
        for x in range(w):
            v = buf[row + x]
            pix[x, y] = 255 - (v * color // 255) if color else (255 - v)
    return img, int(g.bitmap_left), int(g.bitmap_top), w, h


def _paste_rgba(
    dest: Image.Image,
    src_l: Image.Image,
    dx: int,
    dy: int,
    rgba: Tuple[int, int, int, int],
) -> None:
    """מדביק שכבת L כצבע rgba על dest RGBA."""
    w, h = src_l.size
    for y in range(h):
        for x in range(w):
            a = 255 - src_l.getpixel((x, y))
            if a <= 0:
                continue
            px, py = dx + x, dy + y
            if 0 <= px < dest.size[0] and 0 <= py < dest.size[1]:
                dest.putpixel((px, py), rgba)


class GlyphRenderer:
    def __init__(self, font_path: str, size_px: int = 220) -> None:
        self.font_path = font_path
        self.size_px = size_px
        self._stream: Optional[BytesIO] = None
        self.face = freetype.Face(font_path)
        _select_unicode_charmap(self.face)
        self.face.set_pixel_sizes(0, size_px)

    @classmethod
    def from_ttfont(cls, font: "TTFont", size_px: int = 220) -> "GlyphRenderer":
        """רינדור מזיכרון (אחרי ייבוא גליפים שלא נשמרו לדיסק)."""
        self = object.__new__(cls)
        self.font_path = ""
        self.size_px = size_px
        self._stream = BytesIO()
        font.save(self._stream)
        self._stream.seek(0)
        self.face = freetype.Face(self._stream)
        _select_unicode_charmap(self.face)
        self.face.set_pixel_sizes(0, size_px)
        return self

    def refresh_from_ttfont(self, font: "TTFont") -> None:
        """מעדכן את הזרם אחרי שינוי ב־TTFont (GPOS / גליפים)."""
        self._stream = BytesIO()
        font.save(self._stream)
        self._stream.seek(0)
        self.face = freetype.Face(self._stream)
        _select_unicode_charmap(self.face)
        self.face.set_pixel_sizes(0, self.size_px)

    def set_size(self, size_px: int) -> None:
        self.size_px = size_px
        self.face.set_pixel_sizes(0, size_px)

    def _upem(self) -> float:
        return float(self.face.units_per_EM or 1000)

    def _scale(self) -> float:
        return self.size_px / max(self._upem(), 1.0)

    def render_char_with_mark(
        self,
        base_cp: int,
        mark_cp: Optional[int],
        offset_fu_x: float,
        offset_fu_y: float,
        mark2_cp: Optional[int] = None,
        offset2_fu_x: float = 0.0,
        offset2_fu_y: float = 0.0,
    ) -> Image.Image:
        """
        offset_fu_x/y = מיקום סימון ראשון ביחס לבסיס (כמו bx-mx ב-MarkToBase).
        אופציונלי: סימן שני (למשל טעם + ניקוד) עם offset2 יחסית לאות (קירוב גס).
        """
        sc = self._scale()
        img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (255, 255, 255, 255))
        cx, cy = CANVAS_W // 2, int(CANVAS_H * 0.62)

        bi = self.face.get_char_index(base_cp)
        bimg, bl, bt, bw, bh = _render_glyph_slot(self.face, bi, 0)
        if bimg:
            dx = cx - int(bl * sc) - bw // 2
            dy = cy + int(bt * sc) - bh
            _paste_rgba(img, bimg, dx, dy, (30, 80, 160, 255))

        if mark_cp is not None:
            mi = self.face.get_char_index(mark_cp)
            mimg, ml, mt, mw, mh = _render_glyph_slot(self.face, mi, 0)
            if mimg:
                ox = int(offset_fu_x * sc)
                oy = int(-offset_fu_y * sc)
                mdx = cx + ox - int(ml * sc) - mw // 2
                mdy = cy + oy + int(mt * sc) - mh
                _paste_rgba(img, mimg, mdx, mdy, (180, 40, 40, 255))

        if mark2_cp is not None:
            m2i = self.face.get_char_index(mark2_cp)
            m2img, m2l, m2t, m2w, m2h = _render_glyph_slot(self.face, m2i, 0)
            if m2img:
                ox = int((offset_fu_x + offset2_fu_x) * sc)
                oy = int(-(offset_fu_y + offset2_fu_y) * sc)
                mdx = cx + ox - int(m2l * sc) - m2w // 2
                mdy = cy + oy + int(m2t * sc) - m2h
                _paste_rgba(img, m2img, mdx, mdy, (40, 140, 60, 255))

        return img

    def render_char_with_two_marks(
        self,
        base_cp: int,
        mark1_cp: Optional[int],
        off1_fu_x: float,
        off1_fu_y: float,
        mark2_cp: Optional[int],
        off2_fu_x: float,
        off2_fu_y: float,
    ) -> Image.Image:
        """
        Like render_char_with_mark, but mark1 and mark2 offsets are both relative to the base.
        mark2 offset is converted to the internal (relative-to-mark1) form.
        """
        if mark1_cp is None:
            return self.render_char_with_mark(base_cp, mark2_cp, off2_fu_x, off2_fu_y)
        if mark2_cp is None:
            return self.render_char_with_mark(base_cp, mark1_cp, off1_fu_x, off1_fu_y)
        return self.render_char_with_mark(
            base_cp,
            mark1_cp,
            off1_fu_x,
            off1_fu_y,
            mark2_cp=mark2_cp,
            offset2_fu_x=(off2_fu_x - off1_fu_x),
            offset2_fu_y=(off2_fu_y - off1_fu_y),
        )

    def draw_anchor_cross(
        self, image: Image.Image, offset_fu_x: float, offset_fu_y: float
    ) -> Image.Image:
        """מסמן צלב בעיגון (בסיס) במרכז הקנבס."""
        sc = self._scale()
        cx, cy = CANVAS_W // 2, int(CANVAS_H * 0.62)
        ox = int(offset_fu_x * sc)
        oy = int(-offset_fu_y * sc)
        px, py = cx + ox, cy + oy
        draw = ImageDraw.Draw(image)
        r = 8
        draw.line((px - r, py, px + r, py), fill=(200, 0, 120, 255), width=2)
        draw.line((px, py - r, px, py + r), fill=(200, 0, 120, 255), width=2)
        return image

    def render_sample_text(self, text: str) -> Image.Image:
        """טקסט לדוגמה (ללא HarfBuzz — רינדור תו אחר תו, RTL ידני פשוט)."""
        img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (255, 255, 255, 255))
        # פישוט: שרשרת get_char_index ו-advance
        x = CANVAS_W - 40
        y = int(CANVAS_H * 0.55)
        for ch in text:
            cp = ord(ch)
            gi = self.face.get_char_index(cp)
            self.face.load_glyph(gi, freetype.FT_LOAD_RENDER)
            g = self.face.glyph
            bm = g.bitmap
            w, h = int(bm.width), int(bm.rows)
            if w > 0 and h > 0:
                buf = bytes(bm.buffer)
                sg = Image.new("L", (w, h), 255)
                pix = sg.load()
                pitch = int(bm.pitch) if hasattr(bm, "pitch") else w
                stride = abs(pitch) if pitch else w
                for yy in range(h):
                    for xx in range(w):
                        idx = yy * stride + xx
                        if idx >= len(buf):
                            continue
                        v = buf[idx]
                        pix[xx, yy] = 255 - v
                left = int(g.bitmap_left)
                top = int(g.bitmap_top)
                paste_x = x - left - w
                paste_y = y - top
                _paste_rgba(img, sg, paste_x, paste_y, (20, 20, 20, 255))
            x -= int(g.advance.x >> 6) if g.advance.x else w + 4
            if x < 20:
                break
        return img
