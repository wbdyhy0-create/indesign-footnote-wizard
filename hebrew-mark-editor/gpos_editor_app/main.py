#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עורך GPOS לגופנים עבריים — MarkToBase + MarkToMark + תצוגה מקדימה.
הרצה: מתוך תיקייה זו:  python main.py
או:  python -m gpos_editor_app.main  מתוך hebrew-mark-editor
"""

from __future__ import annotations

import os
import sys

# ייבוא יחסי כשמריצים main.py ישירות
_APP_DIR = os.path.dirname(os.path.abspath(__file__))
if _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)

from typing import List, Optional, Tuple

from fontTools.ttLib import TTFont
from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QAction,
    QApplication,
    QFileDialog,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QSplitter,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from editor_widget import AnchorEditorCanvas, MarkToMarkPanel, NudgeButtons, pil_to_qpixmap
from font_loader import FontLoader, _anchor_xy
from glyph_renderer import GlyphRenderer

# --- Unicode (כמו editor.py) ---
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


ALL_MARK_CODES = tuple(_all_mark_codes())


def _cp_label(cp: int) -> str:
    return f"U+{cp:04X}  {chr(cp)}"


class MarkToBaseTab(QWidget):
    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._loader: Optional[FontLoader] = None
        self._renderer: Optional[GlyphRenderer] = None
        self._base_cp = 0x05D0
        self._mark_cp: Optional[int] = None
        self._dirty = False

        outer = QHBoxLayout(self)
        split = QSplitter(Qt.Horizontal)
        outer.addWidget(split)

        left = QWidget()
        left.setMinimumWidth(280)
        left.setMaximumWidth(320)
        lv = QVBoxLayout(left)

        lg = QGroupBox("אות בסיס")
        grid = QGridLayout(lg)
        row = col = 0
        for cp in range(0x05D0, 0x05EB):
            ch = chr(cp)
            b = QPushButton(ch)
            b.setFixedSize(36, 32)
            b.clicked.connect(lambda _=False, c=cp: self._pick_letter(c))
            grid.addWidget(b, row, col)
            col += 1
            if col >= 11:
                col = 0
                row += 1
        lv.addWidget(lg)

        lv.addWidget(QLabel("סימון (מ־cmap)"))
        self._mark_list = QListWidget()
        self._mark_list.setMaximumHeight(260)
        self._mark_list.currentRowChanged.connect(self._on_mark_changed)
        lv.addWidget(self._mark_list)

        self._info = QLabel("טען גופן.")
        self._info.setWordWrap(True)
        lv.addWidget(self._info)

        bx_row = QHBoxLayout()
        bx_row.addWidget(QLabel("BaseAnchor X:"))
        self._spin_bx = QSpinBox()
        self._spin_bx.setRange(-4000, 4000)
        self._spin_bx.valueChanged.connect(self._on_spin_anchor)
        bx_row.addWidget(self._spin_bx)
        lv.addLayout(bx_row)
        by_row = QHBoxLayout()
        by_row.addWidget(QLabel("Y:"))
        self._spin_by = QSpinBox()
        self._spin_by.setRange(-4000, 4000)
        self._spin_by.valueChanged.connect(self._on_spin_anchor)
        by_row.addWidget(self._spin_by)
        lv.addLayout(by_row)

        lv.addWidget(NudgeButtons(self._nudge))

        center = QWidget()
        cv = QVBoxLayout(center)
        sc = 220 / 1000.0
        self._canvas = AnchorEditorCanvas(sc, self._on_drag_fu, self)
        cv.addWidget(self._canvas, alignment=Qt.AlignCenter)

        right = QWidget()
        right.setMinimumWidth(260)
        right.setMaximumWidth(340)
        rv = QVBoxLayout(right)
        rv.addWidget(
            QLabel(
                "גרירה על התצוגה מזיזה את BaseAnchor.\n"
                "הערכים בפאנל השמאלי מתעדכנים אחרי גרירה/חצים."
            )
        )
        rv.addStretch()

        split.addWidget(left)
        split.addWidget(center)
        split.addWidget(right)
        split.setSizes([300, 600, 300])

    def set_font(self, loader: FontLoader, path: str) -> None:
        if self._renderer:
            pass
        self._loader = loader
        self._renderer = GlyphRenderer(path, size_px=220)
        self._dirty = False
        self._fill_marks()
        self._refresh_all()

    def clear_font(self) -> None:
        self._loader = None
        self._renderer = None
        self._mark_list.clear()
        self._info.setText("אין גופן.")

    def is_dirty(self) -> bool:
        return self._dirty

    def mark_dirty(self) -> None:
        self._dirty = True

    def _fill_marks(self) -> None:
        self._mark_list.clear()
        if not self._loader:
            return
        cmap = self._loader.cmap
        for cp in ALL_MARK_CODES:
            if cp in cmap:
                self._mark_list.addItem(_cp_label(cp))
        if self._mark_list.count():
            self._mark_list.setCurrentRow(0)

    def _current_mark_cp(self) -> Optional[int]:
        row = self._mark_list.currentRow()
        if row < 0:
            return None
        text = self._mark_list.item(row).text()
        return int(text.split()[0][2:], 16)

    def _pick_letter(self, cp: int) -> None:
        self._base_cp = cp
        self._refresh_all()

    def _on_mark_changed(self, _row: int) -> None:
        self._refresh_all()

    def _glyph_names(self) -> Tuple[Optional[str], Optional[str]]:
        if not self._loader:
            return None, None
        mcp = self._current_mark_cp()
        if mcp is None:
            return self._loader.get_glyph_name(self._base_cp), None
        return self._loader.get_glyph_name(self._base_cp), self._loader.get_glyph_name(
            mcp
        )

    def _refresh_all(self) -> None:
        if not self._loader or not self._renderer:
            return
        bg, mg = self._glyph_names()
        if not bg:
            self._info.setText("אין גליף לאות בסיס ב־cmap.")
            return
        if not mg:
            self._info.setText("בחרו סימון.")
            return
        mbi = self._loader.find_mark_base(bg, mg)
        if not mbi:
            self._info.setText(
                f"אין MarkToBase עבור:\nבסיס {bg} + סימון {mg}\n"
                "(או חסר עוגן — ניתן ליצור מ־0,0 בעורך הישן / ידנית ב־FEA)."
            )
            self._spin_bx.blockSignals(True)
            self._spin_by.blockSignals(True)
            self._spin_bx.setValue(0)
            self._spin_by.setValue(0)
            self._spin_bx.blockSignals(False)
            self._spin_by.blockSignals(False)
            return
        ba = mbi.get_base_anchor()
        if ba is None:
            self._info.setText("אין BaseAnchor — השתמשו בעורך Tk או הוסיפו ידנית.")
            return
        bx, by = _anchor_xy(ba)
        mx, my = _anchor_xy(mbi.get_mark_anchor())
        self._spin_bx.blockSignals(True)
        self._spin_by.blockSignals(True)
        self._spin_bx.setValue(int(round(bx)))
        self._spin_by.setValue(int(round(by)))
        self._spin_bx.blockSignals(False)
        self._spin_by.blockSignals(False)

        ox, oy = bx - mx, by - my
        img = self._renderer.render_char_with_mark(self._base_cp, self._current_mark_cp(), ox, oy)
        img = self._renderer.draw_anchor_cross(img, 0, 0)
        self._canvas._scale = self._renderer._scale()
        self._canvas.set_pixmap_from_pil(img)
        self._info.setText(
            f"בסיס {bg}  |  סימון {mg}\n"
            f"מחלקת סימון: {mbi.mark_class}  |  "
            f"BaseAnchor: ({bx:.0f}, {by:.0f})  |  MarkAnchor: ({mx:.0f}, {my:.0f})"
        )

    def _on_drag_fu(self, dx: float, dy: float) -> None:
        self._apply_nudge(dx, dy)

    def _nudge(self, dx: int, dy: int) -> None:
        self._apply_nudge(float(dx), float(dy))

    def _apply_nudge(self, dx: float, dy: float) -> None:
        if not self._loader:
            return
        bg, mg = self._glyph_names()
        if not bg or not mg:
            return
        if self._loader.nudge_base_anchor(bg, mg, dx, dy):
            self._dirty = True
            self._refresh_all()

    def _on_spin_anchor(self) -> None:
        if not self._loader:
            return
        bg, mg = self._glyph_names()
        if not bg or not mg:
            return
        mbi = self._loader.find_mark_base(bg, mg)
        if not mbi:
            return
        ba = mbi.get_base_anchor()
        if ba is None:
            return
        x, y = _anchor_xy(ba)
        nx, ny = float(self._spin_bx.value()), float(self._spin_by.value())
        if abs(nx - x) < 1e-6 and abs(ny - y) < 1e-6:
            return
        self._loader.set_base_anchor_xy(bg, mg, nx, ny, create=True)
        self._dirty = True
        self._refresh_all()


class PreviewTab(QWidget):
    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._renderer: Optional[GlyphRenderer] = None
        v = QVBoxLayout(self)
        v.addWidget(QLabel("טקסט לדוגמה (רינדור פשוט תו־תו — לא HarfBuzz):"))
        self._edit = QLineEdit("שָׁלוֹם")
        self._edit.setLayoutDirection(Qt.RightToLeft)
        v.addWidget(self._edit)
        b = QPushButton("רענן תצוגה")
        b.clicked.connect(self._render)
        v.addWidget(b)
        self._lbl = QLabel()
        self._lbl.setMinimumHeight(400)
        self._lbl.setAlignment(Qt.AlignCenter)
        v.addWidget(self._lbl)

    def set_path(self, path: str) -> None:
        self._renderer = GlyphRenderer(path, 200)
        self._render()

    def _render(self) -> None:
        if not self._renderer:
            self._lbl.setText("טען גופן בלשונית MarkToBase.")
            return
        img = self._renderer.render_sample_text(self._edit.text())
        self._lbl.setPixmap(pil_to_qpixmap(img))


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("עורך GPOS — ניקוד וטעמים (עברית)")
        self.resize(1200, 800)
        self._loader: Optional[FontLoader] = None
        self._font_path: Optional[str] = None
        self._dirty_font = False

        self._tabs = QTabWidget()
        self._tab_mtb = MarkToBaseTab()
        self._tab_mtm = MarkToMarkPanel()
        self._tab_prev = PreviewTab()
        self._tabs.addTab(self._tab_mtb, "MarkToBase")
        self._tabs.addTab(self._tab_mtm, "MarkToMark")
        self._tabs.addTab(self._tab_prev, "תצוגה מקדימה")
        self.setCentralWidget(self._tabs)

        m_file = self.menuBar().addMenu("קובץ")
        a_open = QAction("פתח גופן…", self)
        a_open.triggered.connect(self._open_font)
        m_file.addAction(a_open)
        a_save = QAction("שמור גופן (_fixed.ttf)…", self)
        a_save.triggered.connect(self._save_font)
        m_file.addAction(a_save)
        m_help = self.menuBar().addMenu("עזרה")
        a_about = QAction("אודות / מגבלות", self)
        a_about.triggered.connect(self._help)
        m_help.addAction(a_about)

    def _open_font(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "בחר גופן",
            "",
            "Fonts (*.ttf *.TTF *.otf *.OTF);;All (*.*)",
        )
        if not path:
            return
        try:
            probe = TTFont(path)
            if "GPOS" not in probe:
                probe.close()
                QMessageBox.warning(self, "GPOS", "לקובץ אין טבלת GPOS.")
                return
            probe.close()
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        if self._loader:
            self._loader.close()
        try:
            self._loader = FontLoader(path)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        self._font_path = path
        self._dirty_font = False
        self._tab_mtb.set_font(self._loader, path)
        self._tab_mtm.set_loader(self._loader, self._on_any_gpos_edit)
        self._tab_prev.set_path(path)

    def _save_font(self) -> None:
        if not self._loader or not self._font_path:
            QMessageBox.information(self, "שמירה", "אין גופן טעון.")
            return
        base, ext = os.path.splitext(self._font_path)
        default = f"{base}_fixed{ext or '.ttf'}"
        path, _ = QFileDialog.getSaveFileName(
            self, "שמור גופן", default, "Fonts (*.ttf *.otf);;All (*.*)"
        )
        if not path:
            return
        try:
            self._loader.save(path)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        QMessageBox.information(self, "נשמר", path)
        self._tab_mtb._dirty = False
        self._dirty_font = False

    def _on_any_gpos_edit(self) -> None:
        self._dirty_font = True
        self._tab_mtb.mark_dirty()

    def _help(self) -> None:
        QMessageBox.information(
            self,
            "עזרה",
            "• MarkToBase: בוחרים אות וסימון, גוררים או מזינים ערכי BaseAnchor.\n"
            "• MarkToMark: מופיעים זוגות טעם/ניקוד מועמדים; ההחלה מזיזה עוגנים "
            "רק אם כבר קיים כלל mkmk בגופן.\n"
            "• כפתור «חלופה: BaseAnchor על כל האותיות» משפיע על כל הקונטקסטים.\n"
            "• תצוגה מקדימה: רינדור גס ללא HarfBuzz.\n\n"
            "ספריות: fonttools, freetype-py, Pillow, PyQt5.",
        )

    def closeEvent(self, event) -> None:
        if self._dirty_font or self._tab_mtb.is_dirty():
            r = QMessageBox.question(
                self,
                "שמירה",
                "יש שינויים שלא נשמרו. לצאת בלי לשמור?",
                QMessageBox.Yes | QMessageBox.No,
            )
            if r != QMessageBox.Yes:
                event.ignore()
                return
        if self._loader:
            self._loader.close()
        event.accept()


def main() -> None:
    app = QApplication(sys.argv)
    app.setLayoutDirection(Qt.RightToLeft)
    w = MainWindow()
    w.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
