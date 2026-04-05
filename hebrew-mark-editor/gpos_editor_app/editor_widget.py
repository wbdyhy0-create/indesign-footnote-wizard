# -*- coding: utf-8 -*-
"""ווידג'טים: קנבס גרירה ל-MarkToBase, פאנל התנגשויות MarkToMark."""

from __future__ import annotations

from typing import Callable, List, Optional, Tuple, Any

from PyQt5.QtCore import Qt, QPoint
from PyQt5.QtGui import QImage, QMouseEvent, QPainter, QPixmap
from PyQt5.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

from glyph_renderer import CANVAS_H, CANVAS_W


def pil_to_qpixmap(img) -> QPixmap:
    img = img.convert("RGBA")
    data = img.tobytes("raw", "RGBA")
    qimg = QImage(
        data, img.size[0], img.size[1], img.size[0] * 4, QImage.Format_RGBA8888
    )
    return QPixmap.fromImage(qimg)


class AnchorEditorCanvas(QFrame):
    """מציג תמונה; גרירה קוראת callback(dx_fu, dy_fu) ביחידות גופן (לפי scale)."""

    def __init__(
        self,
        scale_px_per_fu: float,
        on_drag_delta: Callable[[float, float], None],
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._scale = max(scale_px_per_fu, 1e-6)
        self._on_drag = on_drag_delta
        self._pixmap: Optional[QPixmap] = None
        self._last_pos: Optional[QPoint] = None
        self.setFixedSize(CANVAS_W, CANVAS_H)
        self.setFrameStyle(QFrame.StyledPanel | QFrame.Plain)

    def set_pixmap_from_pil(self, pil_img) -> None:
        self._pixmap = pil_to_qpixmap(pil_img)
        self.update()

    def paintEvent(self, event) -> None:
        super().paintEvent(event)
        if self._pixmap:
            p = QPainter(self)
            x = (self.width() - self._pixmap.width()) // 2
            y = (self.height() - self._pixmap.height()) // 2
            p.drawPixmap(x, y, self._pixmap)
            p.end()

    def mousePressEvent(self, e: QMouseEvent) -> None:
        if e.button() == Qt.LeftButton:
            self._last_pos = e.pos()

    def mouseMoveEvent(self, e: QMouseEvent) -> None:
        if self._last_pos is None or not (e.buttons() & Qt.LeftButton):
            return
        d = e.pos() - self._last_pos
        self._last_pos = e.pos()
        dx_fu = d.x() / self._scale
        dy_fu = -d.y() / self._scale
        self._on_drag(dx_fu, dy_fu)

    def mouseReleaseEvent(self, e: QMouseEvent) -> None:
        if e.button() == Qt.LeftButton:
            self._last_pos = None


class MarkToMarkPanel(QWidget):
    """רשימת זוגות מועמדים + החלת היסט על כללים קיימים ב־mkmk."""

    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._loader = None
        self._on_changed: Callable[[], None] = lambda: None
        layout = QVBoxLayout(self)
        layout.addWidget(
            QLabel(
                "זוגות (טעם תחתון → ניקוד תחתון) מהגופן. "
                "ההחלה מזיזה עוגן MarkToMark קיים בלבד (אין יצירת טבלה חדשה אוטומטית)."
            )
        )
        self._list = QListWidget()
        self._list.setSelectionMode(QListWidget.MultiSelection)
        layout.addWidget(self._list)

        row = QHBoxLayout()
        row.addWidget(QLabel("dx (FU):"))
        self._dx = QSpinBox()
        self._dx.setRange(-800, 800)
        self._dx.setValue(0)
        row.addWidget(self._dx)
        row.addWidget(QLabel("dy:"))
        self._dy = QSpinBox()
        self._dy.setRange(-800, 800)
        self._dy.setValue(0)
        row.addWidget(self._dy)
        layout.addLayout(row)

        self._btn_apply = QPushButton("החל על הזוגות הנבחרים (MarkToMark)")
        self._btn_apply.clicked.connect(self._on_apply)
        layout.addWidget(self._btn_apply)

        self._btn_heuristic = QPushButton("הגדר dx מומלץ (8% UPEM) והחל על נבחרים")
        self._btn_heuristic.clicked.connect(self._on_heuristic)
        layout.addWidget(self._btn_heuristic)

        self._btn_batch_base = QPushButton(
            "חלופה: הזז BaseAnchor לניקוד על כל האותיות (MarkToBase)"
        )
        self._btn_batch_base.clicked.connect(self._on_batch_base)
        layout.addWidget(self._btn_batch_base)

        self._log = QLabel("")
        self._log.setWordWrap(True)
        layout.addWidget(self._log)

    def set_loader(
        self, loader: Any, on_changed: Optional[Callable[[], None]] = None
    ) -> None:
        self._loader = loader
        self._on_changed = on_changed or (lambda: None)
        self._refresh_list()

    def _refresh_list(self) -> None:
        self._list.clear()
        if not self._loader:
            return
        cmap = self._loader.cmap
        taam_below = [
            0x0591,
            0x0596,
            0x059B,
            0x05A3,
            0x05A4,
            0x05A5,
            0x05A7,
        ]
        nikud_below = [
            0x05B0,
            0x05B1,
            0x05B2,
            0x05B3,
            0x05B4,
            0x05B5,
            0x05B6,
            0x05B7,
            0x05B8,
            0x05B9,
            0x05BB,
            0x05BC,
            0x05BD,
        ]
        for t_cp in taam_below:
            g1 = cmap.get(t_cp)
            if not g1:
                continue
            for n_cp in nikud_below:
                g2 = cmap.get(n_cp)
                if not g2:
                    continue
                has_mkmk = self._loader.find_mark_mark(g1, g2) is not None
                tag = "✓ mkmk" if has_mkmk else "— אין mkmk"
                label = f"{tag}  {g1} + {g2}  (U+{t_cp:04X} → U+{n_cp:04X})"
                it = QListWidgetItem(label)
                it.setData(Qt.UserRole, (g1, g2))
                self._list.addItem(it)

    def _selected_pairs(self) -> List[Tuple[str, str]]:
        out: List[Tuple[str, str]] = []
        for i in range(self._list.count()):
            it = self._list.item(i)
            if it.isSelected():
                data = it.data(Qt.UserRole)
                if data:
                    g1, g2 = data
                    out.append((g1, g2))
        return out

    def _on_apply(self) -> None:
        if not self._loader:
            return
        pairs = self._selected_pairs()
        if not pairs:
            QMessageBox.information(self, "בחירה", "בחרו זוגות מהרשימה.")
            return
        dx, dy = float(self._dx.value()), float(self._dy.value())
        n = self._loader.batch_nudge_mark_to_mark_pairs(pairs, dx, dy)
        self._log.setText(f"עודכנו {n} עוגני MarkToMark (מתוך {len(pairs)} זוגות נבחרים).")
        if n:
            self._on_changed()

    def _on_heuristic(self) -> None:
        if not self._loader:
            return
        dx = int(round(self._loader.upem * 0.08))
        self._dx.setValue(dx)
        self._dy.setValue(0)
        pairs = self._selected_pairs()
        if not pairs:
            QMessageBox.information(self, "בחירה", "בחרו זוגות, או לחצו על «החל» אחרי בחירה.")
            return
        n = self._loader.batch_nudge_mark_to_mark_pairs(pairs, float(dx), 0.0)
        self._log.setText(f"הוחל dx≈8% UPEM ({dx} FU): עודכנו {n} עוגנים.")
        if n:
            self._on_changed()

    def _on_batch_base(self) -> None:
        """הזזת כל BaseAnchor של מחלקת הניקוד — משפיע על כל הקונטקסטים."""
        if not self._loader:
            return
        pairs = self._selected_pairs()
        if not pairs:
            QMessageBox.information(self, "בחירה", "בחרו זוגות; יילקח ניקוד מכל זוג.")
            return
        nikud_glyphs = list({g2 for _g1, g2 in pairs})
        dx, dy = float(self._dx.value()), float(self._dy.value())
        total = 0
        for g2 in nikud_glyphs:
            total += self._loader.batch_nudge_mark_base_for_mark(g2, dx, dy)
        self._log.setText(
            f"MarkToBase: עודכנו {total} עוגני בסיס עבור {len(nikud_glyphs)} גליפי ניקוד."
        )
        QMessageBox.warning(
            self,
            "שימו לב",
            "שינוי BaseAnchor לניקוד משפיע על כל האותיות שאליהן הניקוד מתחבר, "
            "לא רק כשיש טעם.",
        )
        if total:
            self._on_changed()


class NudgeButtons(QWidget):
    def __init__(
        self, on_nudge: Callable[[int, int], None], parent: Optional[QWidget] = None
    ) -> None:
        super().__init__(parent)
        row = QHBoxLayout(self)
        for lbl, dx, dy in (("←", -20, 0), ("→", 20, 0), ("↑", 0, 20), ("↓", 0, -20)):
            b = QPushButton(lbl)
            b.clicked.connect(lambda _=None, x=dx, y=dy: on_nudge(x, y))
            row.addWidget(b)
