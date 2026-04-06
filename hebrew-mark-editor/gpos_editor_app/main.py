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

from typing import Callable, List, Optional, Tuple

try:
    from fontTools.ttLib import TTFont
    from PyQt5.QtCore import Qt
    from PyQt5.QtGui import QColor
    from PyQt5.QtWidgets import (
        QAction,
        QApplication,
        QCheckBox,
        QDialog,
        QFileDialog,
        QGridLayout,
        QGroupBox,
        QHBoxLayout,
        QLabel,
        QLineEdit,
        QListWidget,
        QListWidgetItem,
        QMainWindow,
        QMessageBox,
        QPushButton,
        QSpinBox,
        QSplitter,
        QTabWidget,
        QTextEdit,
        QVBoxLayout,
        QWidget,
    )

    from editor_widget import AnchorEditorCanvas, MarkToMarkPanel, NudgeButtons, pil_to_qpixmap
    from font_loader import FontLoader, _anchor_xy
    from glyph_importer import (
        NIQQUD_ROWS,
        TAAMIM_ROWS,
        copy_gpos_and_scale_for_upem,
        import_niqqud,
        import_taamim,
        upem_pair_message,
    )
    from gpos_profile import apply_profile_to_font, load_profile_json, save_profile_json
    from glyph_renderer import GlyphRenderer
except Exception as _startup_exc:
    import traceback

    print("Failed to start GPOS editor (missing or broken dependency).", file=sys.stderr)
    print(_startup_exc, file=sys.stderr)
    traceback.print_exc()
    print(
        "\nFix: open cmd in hebrew-mark-editor folder and run:\n"
        "  python -m pip install -r requirements.txt\n"
        "\nIf you use Python 3.14: PyQt5 often has no wheel yet. "
        "Install Python 3.12 from python.org (check Add to PATH), then run again.",
        file=sys.stderr,
    )
    try:
        input("\nPress Enter to close this window...")
    except EOFError:
        pass
    raise SystemExit(1) from _startup_exc

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

_LAST_FILE_DIR: str = ""


def _default_fonts_dir() -> str:
    w = os.environ.get("WINDIR", r"C:\Windows")
    p = os.path.join(w, "Fonts")
    if os.path.isdir(p):
        return p
    return os.path.expanduser("~")


def _pick_start_dir(current_path: str = "") -> str:
    global _LAST_FILE_DIR
    cur = (current_path or "").strip()
    if cur:
        d = os.path.dirname(cur)
        if d and os.path.isdir(d):
            _LAST_FILE_DIR = d
            return d
    if _LAST_FILE_DIR and os.path.isdir(_LAST_FILE_DIR):
        return _LAST_FILE_DIR
    _LAST_FILE_DIR = _default_fonts_dir()
    return _LAST_FILE_DIR


def _remember_dir(path: str) -> None:
    global _LAST_FILE_DIR
    if path:
        d = os.path.dirname(path)
        if d and os.path.isdir(d):
            _LAST_FILE_DIR = d


def _cp_label(cp: int) -> str:
    return f"U+{cp:04X}  {chr(cp)}"


class CalibrationTab(QWidget):
    """MarkToBase + MarkToMark כלשוניות פנימיות."""

    def __init__(self, mtb: QWidget, mtm: QWidget, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        tw = QTabWidget()
        tw.addTab(mtb, "MarkToBase")
        tw.addTab(mtm, "MarkToMark")
        QVBoxLayout(self).addWidget(tw)


class ImportTab(QWidget):
    """ייבוא טעמים/ניקוד מגופן מקור לגופן היעד הטעון."""

    def __init__(
        self,
        get_loader: Callable[[], Optional[FontLoader]],
        get_target_path: Callable[[], str],
        open_target: Callable[[], None],
        on_import_done: Callable[[int, bool, List[str], str], None],
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._get_loader = get_loader
        self._get_target_path = get_target_path
        self._open_target = open_target
        self._on_import_done = on_import_done

        v = QVBoxLayout(self)
        v.addWidget(
            QLabel(
                "מעתיקים גליפי טעמים (טבלת טעמים למטה) מגופן שכבר כולל אותם "
                "(למשל Guttman Frank, Ezra SIL, SBL Hebrew)."
            )
        )
        row = QHBoxLayout()
        row.addWidget(QLabel("גופן מקור:"))
        self._src = QLineEdit()
        row.addWidget(self._src)
        b_src = QPushButton("…")
        b_src.clicked.connect(self._browse_src)
        row.addWidget(b_src)
        v.addLayout(row)

        self._tgt_lbl = QLabel("גופן יעד: לא נטען — פתחו מקובץ ← פתח גופן.")
        self._tgt_lbl.setWordWrap(True)
        row_t = QHBoxLayout()
        row_t.addWidget(self._tgt_lbl, 1)
        self._b_open_target = QPushButton("פתח גופן יעד…")
        self._b_open_target.clicked.connect(self._open_target)
        row_t.addWidget(self._b_open_target)
        v.addLayout(row_t)
        self._upem_lbl = QLabel("")
        v.addWidget(self._upem_lbl)

        self._chk_gpos = QCheckBox(
            "לאחר הייבוא: להעתיק את טבלת GPOS מהמקור ולסקייל עוגני Mark אם ה-UPM שונה"
        )
        self._chk_gpos.setChecked(True)
        v.addWidget(self._chk_gpos)

        self._chk_niqqud = QCheckBox("כלול גם ניקוד (U+05B0–U+05C7)")
        self._chk_niqqud.setChecked(True)
        v.addWidget(self._chk_niqqud)

        self._list = QListWidget()
        self._list.setSelectionMode(QListWidget.MultiSelection)
        v.addWidget(self._list)

        h = QHBoxLayout()
        self._b_ref = QPushButton("רענן רשימה")
        self._b_ref.clicked.connect(self.refresh_list)
        self._b_prev = QPushButton("תצוגה מקדימה (מהמקור)")
        self._b_prev.clicked.connect(self._preview_selected_from_source)
        h.addWidget(self._b_ref)
        h.addWidget(self._b_prev)
        v.addLayout(h)

        h2 = QHBoxLayout()
        self._b_all = QPushButton("ייבא הכל")
        self._b_all.clicked.connect(lambda: self._run_import(all_rows=True))
        self._b_sel = QPushButton("ייבא נבחרים")
        self._b_sel.clicked.connect(lambda: self._run_import(all_rows=False))
        h2.addWidget(self._b_all)
        h2.addWidget(self._b_sel)
        v.addLayout(h2)
        self._sync_enabled()

    def update_target_label(self) -> None:
        p = self._get_target_path()
        self._tgt_lbl.setText(f"גופן יעד: {p}" if p else "גופן יעד: לא נטען — פתחו מקובץ.")
        self._sync_enabled()

    def _sync_enabled(self) -> None:
        has_target = self._get_loader() is not None
        self._b_all.setEnabled(has_target)
        self._b_sel.setEnabled(has_target)
        # Refresh/preview still useful even without target (source preview),
        # but keeping them enabled avoids blocking the user.

    def refresh_list(self) -> None:
        self._list.clear()
        loader = self._get_loader()
        tgt_cmap = loader.cmap if loader else {}
        rows = list(TAAMIM_ROWS) + (list(NIQQUD_ROWS) if self._chk_niqqud.isChecked() else [])
        for cp, he_name in rows:
            ok = cp in tgt_cmap
            it = QListWidgetItem(f"{'✓' if ok else '✗'}  {_cp_label(cp)}  —  {he_name}")
            it.setData(Qt.UserRole, cp)
            it.setForeground(QColor(0, 130, 60) if ok else QColor(190, 30, 30))
            self._list.addItem(it)

        src_p = self._src.text().strip()
        tgt_p = self._get_target_path()
        if src_p and tgt_p:
            try:
                s = TTFont(src_p)
                t = TTFont(tgt_p)
                try:
                    self._upem_lbl.setText(upem_pair_message(s, t))
                finally:
                    s.close()
                    t.close()
            except Exception as e:
                self._upem_lbl.setText(f"בדיקת UPM נכשלה: {e}")
        else:
            self._upem_lbl.setText("")

    def _browse_src(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "גופן מקור (עם טעמים)",
            _pick_start_dir(self._src.text()),
            "Fonts (*.ttf *.TTF *.otf *.OTF *.ttc *.TTC);;All (*.*)",
        )
        if path:
            self._src.setText(path)
            _remember_dir(path)
            self.refresh_list()

    def _preview_selected_from_source(self) -> None:
        src_p = self._src.text().strip()
        if not src_p:
            QMessageBox.information(self, "מקור", "בחרו קובץ גופן מקור.")
            return
        row = self._list.currentRow()
        if row < 0:
            QMessageBox.information(self, "בחירה", "בחרו שורה ברשימה.")
            return
        cp = self._list.item(row).data(Qt.UserRole)
        try:
            img = GlyphRenderer(src_p, 160).render_sample_text(chr(int(cp)))
        except Exception as e:
            QMessageBox.critical(self, "רינדור", str(e))
            return
        dlg = QDialog(self)
        dlg.setWindowTitle("תצוגה מקדימה")
        lv = QVBoxLayout(dlg)
        lv.addWidget(QLabel(f"טעם U+{int(cp):04X} מגופן המקור"))
        lbl = QLabel()
        lbl.setPixmap(pil_to_qpixmap(img))
        lv.addWidget(lbl)
        dlg.exec_()

    def _run_import(self, all_rows: bool) -> None:
        loader = self._get_loader()
        if not loader:
            QMessageBox.warning(
                self,
                "יעד",
                "לא נטען גופן יעד.\n\n"
                "לחצו «פתח גופן יעד…» בלשונית זו או מתפריט «קובץ → פתח גופן».",
            )
            return
        src_p = self._src.text().strip()
        if not src_p:
            QMessageBox.warning(self, "מקור", "בחרו גופן מקור.")
            return
        if all_rows:
            cps = [cp for cp, _ in TAAMIM_ROWS]
            if self._chk_niqqud.isChecked():
                cps += [cp for cp, _ in NIQQUD_ROWS]
        else:
            cps = []
            for it in self._list.selectedItems():
                cps.append(int(it.data(Qt.UserRole)))
        if not cps:
            QMessageBox.information(self, "בחירה", "בחרו שורות ברשימה.")
            return

        source = TTFont(src_p)
        gpos_detail = ""
        try:
            taamim = set(cp for cp, _ in TAAMIM_ROWS)
            niqqud = set(cp for cp, _ in NIQQUD_ROWS)
            cps_taamim = [cp for cp in cps if cp in taamim]
            cps_niqqud = [cp for cp in cps if cp in niqqud]

            n_ok = 0
            errs: List[str] = []
            if cps_taamim:
                a, e = import_taamim(source, loader.font, cps_taamim)
                n_ok += a
                errs.extend(e)
            if cps_niqqud:
                a, e = import_niqqud(source, loader.font, cps_niqqud)
                n_ok += a
                errs.extend(e)
            gpos_copied = False
            if self._chk_gpos.isChecked():
                gok, gpos_detail = copy_gpos_and_scale_for_upem(source, loader.font)
                gpos_copied = gok
        finally:
            source.close()

        loader.refresh_cmap()
        self._on_import_done(n_ok, gpos_copied, errs, gpos_detail)
        self.refresh_list()


class ProfilesTab(QWidget):
    """שמירה והחלה של פרופיל עוגני GPOS (JSON)."""

    def __init__(
        self,
        get_loader: Callable[[], Optional[FontLoader]],
        on_applied: Callable[[], None],
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._get_loader = get_loader
        self._on_applied = on_applied
        self._path_edit = QLineEdit()
        v = QVBoxLayout(self)
        v.addWidget(
            QLabel(
                "לאחר כיול על משקל אחד (למשל Regular) — שמרו פרופיל, "
                "ואז החילו על Bold/Light עם אותם גליפי טעמים."
            )
        )
        row = QHBoxLayout()
        row.addWidget(QLabel("קובץ פרופיל:"))
        row.addWidget(self._path_edit)
        b_browse = QPushButton("…")
        b_browse.clicked.connect(self._browse)
        row.addWidget(b_browse)
        v.addLayout(row)

        b_save = QPushButton("שמור פרופיל מגופן הטעון…")
        b_save.clicked.connect(self._save_profile)
        v.addWidget(b_save)
        b_apply = QPushButton("החל פרופיל על הגופן הטעון")
        b_apply.clicked.connect(self._apply_profile)
        v.addWidget(b_apply)
        self._log = QLabel("")
        self._log.setWordWrap(True)
        v.addWidget(self._log)

    def _browse(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "פרופיל GPOS",
            _pick_start_dir(self._path_edit.text()),
            "JSON (*.json);;All (*.*)",
        )
        if path:
            self._path_edit.setText(path)
            _remember_dir(path)

    def _save_profile(self) -> None:
        loader = self._get_loader()
        if not loader:
            QMessageBox.warning(self, "גופן", "אין גופן טעון.")
            return
        path, _ = QFileDialog.getSaveFileName(
            self,
            "שמירת פרופיל",
            os.path.join(_pick_start_dir(self._path_edit.text()), "my_font.gpos_profile.json"),
            "JSON (*.json);;All (*.*)",
        )
        if not path:
            return
        _remember_dir(path)
        name = os.path.splitext(os.path.basename(path))[0]
        try:
            save_profile_json(loader.font, name, path)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        self._path_edit.setText(path)
        self._log.setText(f"נשמר: {path}")
        QMessageBox.information(self, "פרופיל", f"נשמר: {path}")

    def _apply_profile(self) -> None:
        loader = self._get_loader()
        p = self._path_edit.text().strip()
        if not loader or not p:
            QMessageBox.warning(self, "חסר", "טענו גופן ובחרו קובץ פרופיל.")
            return
        try:
            data = load_profile_json(p)
            mtb_ok, mtm_ok, sk1, sk2 = apply_profile_to_font(loader.font, data)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        self._log.setText(
            f"MarkToBase עודכן: {mtb_ok}, דולגו: {sk1}. "
            f"MarkToMark עודכן: {mtm_ok}, דולגו: {sk2}."
        )
        self._on_applied()
        QMessageBox.information(
            self,
            "הוחל",
            f"סיום החלה. עודכנו זוגות MarkToBase: {mtb_ok}, MarkToMark: {mtm_ok}.",
        )


class SaveTab(QWidget):
    """דוח סשן ושמירה עם שם מומלץ _with_taamim."""

    def __init__(
        self,
        get_report_lines: Callable[[], List[str]],
        save_with_suffix: Callable[[str], None],
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._get_report_lines = get_report_lines
        self._save_with_suffix = save_with_suffix
        v = QVBoxLayout(self)
        v.addWidget(QLabel("סיכום סשן (מאז פתיחת הגופן):"))
        self._text = QTextEdit()
        self._text.setReadOnly(True)
        self._text.setMaximumHeight(220)
        v.addWidget(self._text)
        b = QPushButton('שמור גופן חדש (סיומת "_with_taamim")')
        b.clicked.connect(lambda: self._save_with_suffix("_with_taamim"))
        v.addWidget(b)
        b2 = QPushButton('שמור כ־"_fixed" (כמו בתפריט)')
        b2.clicked.connect(lambda: self._save_with_suffix("_fixed"))
        v.addWidget(b2)
        v.addWidget(
            QLabel("הקובץ נשמר כטקסט מלא; ניתן להתקין ב-Windows ולהשתמש באינדיזיין.")
        )

    def refresh(self) -> None:
        self._text.setPlainText("\n".join(self._get_report_lines()))


class MarkToBaseTab(QWidget):
    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._loader: Optional[FontLoader] = None
        self._renderer: Optional[GlyphRenderer] = None
        self._base_cp = 0x05D0
        self._mark_cp: Optional[int] = None
        self._pinned_mark_cp: Optional[int] = None
        self._last_mark_cp: Optional[int] = None
        self._dirty = False
        self._use_memory = False
        self._font_path = ""

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

        pin_row = QHBoxLayout()
        self._chk_pin_prev = QCheckBox("הצג גם את הסימון הקודם (מוצמד בירוק)")
        self._chk_pin_prev.setChecked(True)
        pin_row.addWidget(self._chk_pin_prev, 1)
        self._b_clear_pin = QPushButton("בטל הצמדה")
        self._b_clear_pin.clicked.connect(self._clear_pin)
        pin_row.addWidget(self._b_clear_pin)
        lv.addLayout(pin_row)

        self._b_create_pair = QPushButton("צור זוג MarkToBase לזוג שנבחר")
        self._b_create_pair.clicked.connect(self._create_mark_to_base_pair)
        lv.addWidget(self._b_create_pair)

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

    def set_font(
        self, loader: FontLoader, path: str, use_memory_preview: bool = False
    ) -> None:
        self._loader = loader
        self._font_path = path
        self._use_memory = use_memory_preview
        if use_memory_preview:
            self._renderer = GlyphRenderer.from_ttfont(loader.font, size_px=220)
        else:
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

    def set_use_memory_preview(self, enabled: bool) -> None:
        if not self._loader:
            return
        self._use_memory = enabled
        if enabled:
            try:
                self._renderer = GlyphRenderer.from_ttfont(self._loader.font, size_px=220)
            except Exception as e:
                self._use_memory = False
                self._renderer = GlyphRenderer(self._font_path, size_px=220)
                QMessageBox.warning(
                    self,
                    "תצוגה מזיכרון",
                    "לא ניתן להציג תצוגה מזיכרון אחרי הייבוא.\n"
                    "זה בדרך כלל קורה כש־GPOS שהועתק מפנה לשמות גליפים שלא קיימים ביעד.\n\n"
                    f"פרטים: {e}\n\n"
                    "המשך עבודה ייעשה מתצוגה מהקובץ בדיסק.",
                )
        else:
            self._renderer = GlyphRenderer(self._font_path, size_px=220)
        self._refresh_all()

    def refresh_face_from_font(self) -> None:
        if self._use_memory and self._loader and self._renderer:
            self._renderer.refresh_from_ttfont(self._loader.font)

    def refresh_after_cmap_change(self) -> None:
        self._fill_marks()
        self.refresh_face_from_font()
        self._refresh_all()

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
        cur = self._current_mark_cp()
        if self._chk_pin_prev.isChecked() and self._last_mark_cp is not None and cur != self._last_mark_cp:
            self._pinned_mark_cp = self._last_mark_cp
        self._last_mark_cp = cur
        self._refresh_all()

    def _clear_pin(self) -> None:
        self._pinned_mark_cp = None
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
        # Always render at least the base letter, even if a mark isn't selected yet.
        if not mg:
            img = self._renderer.render_char_with_mark(self._base_cp, None, 0.0, 0.0)
            img = self._renderer.draw_anchor_cross(img, 0, 0)
            self._canvas._scale = self._renderer._scale()
            self._canvas.set_pixmap_from_pil(img)
            self._info.setText(f"בסיס {bg}\nבחרו סימון מהרשימה כדי לערוך MarkToBase.")
            return
        mbi = self._loader.find_mark_base(bg, mg)
        if not mbi:
            # Render a best-effort preview anyway (base + mark at zero offset),
            # and explain that the pair is missing in GPOS.
            img = self._renderer.render_char_with_mark(
                self._base_cp, self._current_mark_cp(), 0.0, 0.0
            )
            img = self._renderer.draw_anchor_cross(img, 0, 0)
            self._canvas._scale = self._renderer._scale()
            self._canvas.set_pixmap_from_pil(img)
            self._info.setText(
                f"אין MarkToBase עבור:\nבסיס {bg} + סימון {mg}\n"
                "כרגע מוצגת תצוגה בסיסית בלבד. כדי לכייל צריך ליצור זוג/עוגנים (MarkToBase)."
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
            img = self._renderer.render_char_with_mark(
                self._base_cp, self._current_mark_cp(), 0.0, 0.0
            )
            img = self._renderer.draw_anchor_cross(img, 0, 0)
            self._canvas._scale = self._renderer._scale()
            self._canvas.set_pixmap_from_pil(img)
            self._info.setText("אין BaseAnchor — כרגע מוצגת תצוגה בסיסית בלבד. צרו עוגן ואז כיילו.")
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

        # Optional pinned (second) mark preview: render both marks at their own MarkToBase offsets.
        pin_cp = self._pinned_mark_cp
        if pin_cp is not None and pin_cp != self._current_mark_cp():
            pin_g = self._loader.get_glyph_name(pin_cp)
            if pin_g:
                pin_mbi = self._loader.find_mark_base(bg, pin_g)
                if pin_mbi and pin_mbi.get_base_anchor() is not None:
                    pbx, pby = _anchor_xy(pin_mbi.get_base_anchor())
                    pmx, pmy = _anchor_xy(pin_mbi.get_mark_anchor())
                    pox, poy = pbx - pmx, pby - pmy
                    img = self._renderer.render_char_with_two_marks(
                        self._base_cp,
                        self._current_mark_cp(),
                        ox,
                        oy,
                        pin_cp,
                        pox,
                        poy,
                    )
                else:
                    img = self._renderer.render_char_with_mark(self._base_cp, self._current_mark_cp(), ox, oy)
            else:
                img = self._renderer.render_char_with_mark(self._base_cp, self._current_mark_cp(), ox, oy)
        else:
            img = self._renderer.render_char_with_mark(self._base_cp, self._current_mark_cp(), ox, oy)
        img = self._renderer.draw_anchor_cross(img, 0, 0)
        self._canvas._scale = self._renderer._scale()
        self._canvas.set_pixmap_from_pil(img)
        self._info.setText(
            f"בסיס {bg}  |  סימון {mg}\n"
            f"מחלקת סימון: {mbi.mark_class}  |  "
            f"BaseAnchor: ({bx:.0f}, {by:.0f})  |  MarkAnchor: ({mx:.0f}, {my:.0f})"
        )

    def _create_mark_to_base_pair(self) -> None:
        if not self._loader:
            return
        bg, mg = self._glyph_names()
        if not bg or not mg:
            QMessageBox.information(self, "חסר", "בחרו אות בסיס וסימון מהרשימה.")
            return
        ok = self._loader.ensure_mark_to_base_pair(bg, mg)
        if not ok:
            QMessageBox.warning(
                self,
                "יצירה",
                "לא הצלחתי ליצור זוג MarkToBase.\n"
                "או שאין בכלל MarkToBase בגופן, או שמבנה ה-GPOS לא נתמך ליצירה אוטומטית.\n\n"
                "במקרה כזה צריך להתחיל מגופן שיש בו MarkToBase, או לבצע עריכה ידנית.",
            )
            return
        self._dirty = True
        self.refresh_after_cmap_change()

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
    SAMPLE = "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים"

    def __init__(self, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self._loader: Optional[FontLoader] = None
        self._disk_path = ""
        self._use_memory = False
        v = QVBoxLayout(self)
        v.addWidget(
            QLabel(
                "טקסט לדוגמה (רינדור פשוט תו־תו — לא HarfBuzz). "
                "«אחרי» = הגופן הטעון; «לפני» = קובץ אופציונלי להשוואה."
            )
        )
        self._edit = QLineEdit(self.SAMPLE)
        self._edit.setLayoutDirection(Qt.RightToLeft)
        v.addWidget(self._edit)
        row_b = QHBoxLayout()
        row_b.addWidget(QLabel("גופן «לפני» (אופציונלי):"))
        self._before_path = QLineEdit()
        row_b.addWidget(self._before_path)
        bb = QPushButton("…")
        bb.clicked.connect(self._browse_before)
        row_b.addWidget(bb)
        v.addLayout(row_b)
        b = QPushButton("רענן תצוגה")
        b.clicked.connect(self._render)
        v.addWidget(b)
        row = QHBoxLayout()
        vb = QVBoxLayout()
        vb.addWidget(QLabel("לפני (אופציונלי)"))
        self._lbl_before = QLabel()
        self._lbl_before.setMinimumHeight(300)
        self._lbl_before.setAlignment(Qt.AlignCenter)
        vb.addWidget(self._lbl_before)
        va = QVBoxLayout()
        va.addWidget(QLabel("אחרי (גופן טעון)"))
        self._lbl_after = QLabel()
        self._lbl_after.setMinimumHeight(300)
        self._lbl_after.setAlignment(Qt.AlignCenter)
        va.addWidget(self._lbl_after)
        row.addLayout(vb, 1)
        row.addLayout(va, 1)
        v.addLayout(row)

    def _browse_before(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "גופן לפני (השוואה)",
            _pick_start_dir(self._before_path.text()),
            "Fonts (*.ttf *.TTF *.otf *.OTF *.ttc *.TTC);;All (*.*)",
        )
        if path:
            self._before_path.setText(path)
            _remember_dir(path)
            self._render()

    def set_context(
        self,
        loader: Optional[FontLoader],
        disk_path: str,
        use_memory: bool,
    ) -> None:
        self._loader = loader
        self._disk_path = disk_path
        self._use_memory = use_memory
        self._render()

    def _renderer_after(self) -> Optional[GlyphRenderer]:
        if self._use_memory and self._loader:
            return GlyphRenderer.from_ttfont(self._loader.font, 180)
        if self._disk_path:
            return GlyphRenderer(self._disk_path, 180)
        return None

    def _render(self) -> None:
        txt = self._edit.text() or self.SAMPLE
        ra = self._renderer_after()
        if ra:
            try:
                self._lbl_after.setPixmap(pil_to_qpixmap(ra.render_sample_text(txt)))
            except Exception as e:
                self._lbl_after.setText(str(e))
        else:
            self._lbl_after.setText("טענו גופן יעד.")

        bp = self._before_path.text().strip()
        if bp:
            try:
                rb = GlyphRenderer(bp, 180)
                self._lbl_before.setPixmap(pil_to_qpixmap(rb.render_sample_text(txt)))
            except Exception as e:
                self._lbl_before.setText(str(e))
        else:
            self._lbl_before.setText("(ללא קובץ «לפני»)")


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("עורך GPOS — ניקוד וטעמים (עברית)")
        self.resize(1200, 800)
        self._loader: Optional[FontLoader] = None
        self._font_path: Optional[str] = None
        self._dirty_font = False
        self._import_count = 0
        self._gpos_copied_session = False
        self._use_memory_preview = False

        self._tabs = QTabWidget()
        self._tab_import = ImportTab(
            lambda: self._loader,
            lambda: self._font_path or "",
            self._open_font,
            self._after_import,
        )
        self._tab_mtb = MarkToBaseTab()
        self._tab_mtm = MarkToMarkPanel()
        self._tab_calibration = CalibrationTab(self._tab_mtb, self._tab_mtm)
        self._tab_profiles = ProfilesTab(
            lambda: self._loader, self._on_profile_applied
        )
        self._tab_prev = PreviewTab()
        self._tab_save = SaveTab(self._save_report_lines, self._save_with_suffix_choice)

        self._tabs.addTab(self._tab_import, "ייבוא גליפים")
        self._tabs.addTab(self._tab_calibration, "כיול GPOS")
        self._tabs.addTab(self._tab_profiles, "פרופילים")
        self._tabs.addTab(self._tab_prev, "תצוגה מקדימה")
        self._tabs.addTab(self._tab_save, "שמירה")
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

        self._tab_save.refresh()

    def _open_font(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "בחר גופן",
            _pick_start_dir(self._font_path or ""),
            "Fonts (*.ttf *.TTF *.otf *.OTF *.ttc *.TTC);;All (*.*)",
        )
        if not path:
            return
        _remember_dir(path)
        try:
            probe = TTFont(path)
            has_gpos = "GPOS" in probe
            probe.close()
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        if not has_gpos:
            QMessageBox.information(
                self,
                "GPOS",
                "לקובץ אין טבלת GPOS. אפשר לייבא טעמים ולהעתיק GPOS מגופן מקור, "
                "או להמשיך אם תוסיפו כללים בנפרד.",
            )
        if self._loader:
            self._loader.close()
        try:
            self._loader = FontLoader(path)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        self._font_path = path
        self._dirty_font = False
        self._import_count = 0
        self._gpos_copied_session = False
        self._use_memory_preview = False
        self._tab_mtb.set_font(self._loader, path, use_memory_preview=False)
        self._tab_mtm.set_loader(self._loader, self._on_any_gpos_edit)
        self._tab_prev.set_context(self._loader, path, False)
        self._tab_import.update_target_label()
        self._tab_import.refresh_list()
        self._tab_save.refresh()

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
        _remember_dir(path)
        try:
            self._loader.save(path)
        except Exception as e:
            QMessageBox.critical(self, "שגיאה", str(e))
            return
        QMessageBox.information(self, "נשמר", path)
        self._tab_mtb._dirty = False
        self._dirty_font = False
        self._tab_save.refresh()

    def _save_report_lines(self) -> List[str]:
        return [
            f"נתיב גופן: {self._font_path or '—'}",
            f"סה״כ ייבואי גליף מוצלחים בסשן: {self._import_count}",
            f"הועתק GPOS מגופן מקור בייבוא: {'כן' if self._gpos_copied_session else 'לא'}",
            f"תצוגה מזיכרון (אחרי ייבוא גליפים): {'כן' if self._use_memory_preview else 'לא'}",
        ]

    def _save_with_suffix_choice(self, suffix_key: str) -> None:
        if not self._loader or not self._font_path:
            QMessageBox.information(self, "שמירה", "אין גופן טעון.")
            return
        base, ext = os.path.splitext(self._font_path)
        ext = ext or ".ttf"
        if suffix_key == "_with_taamim":
            default = f"{base}_with_taamim{ext}"
            title = "שמור גופן (_with_taamim)"
        else:
            default = f"{base}_fixed{ext}"
            title = "שמור גופן (_fixed)"
        path, _ = QFileDialog.getSaveFileName(
            self, title, default, "Fonts (*.ttf *.otf);;All (*.*)"
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
        self._tab_save.refresh()

    def _after_import(
        self, n_ok: int, gpos_copied: bool, errs: List[str], gpos_detail: str
    ) -> None:
        self._import_count += n_ok
        if gpos_copied:
            self._gpos_copied_session = True
        self._use_memory_preview = True
        if self._loader:
            try:
                self._tab_mtb.set_use_memory_preview(True)
            except Exception:
                self._use_memory_preview = False
            self._tab_mtb._fill_marks()
            self._tab_mtb._refresh_all()
            self._tab_mtm.set_loader(self._loader, self._on_any_gpos_edit)
            self._tab_prev.set_context(
                self._loader, self._font_path or "", True
            )
        self._tab_save.refresh()
        self._on_any_gpos_edit()
        msg = f"סיום ייבוא: {n_ok} גליפים הועתקו בהצלחה."
        if gpos_detail:
            msg += f"\n{gpos_detail}"
        if errs:
            msg += "\n\nדיווחים:\n" + "\n".join(errs[:10])
            if len(errs) > 10:
                msg += "\n…"
        QMessageBox.information(self, "ייבוא", msg)

    def _on_profile_applied(self) -> None:
        if not self._loader:
            return
        self._tab_mtb._refresh_all()
        self._tab_mtm.set_loader(self._loader, self._on_any_gpos_edit)
        self._tab_prev.set_context(
            self._loader, self._font_path or "", self._use_memory_preview
        )
        self._tab_save.refresh()
        self._on_any_gpos_edit()

    def _on_any_gpos_edit(self) -> None:
        self._dirty_font = True
        self._tab_mtb.mark_dirty()

    def _help(self) -> None:
        QMessageBox.information(
            self,
            "עזרה",
            "• ייבוא גליפים: מעתיק טעמים מגופן מקור ליעד הטעון; אופציה להעתיק GPOS "
            "ולסקייל עוגני Mark אם ה-UPM שונה.\n"
            "• כיול GPOS: MarkToBase ו-MarkToMark כמו קודם.\n"
            "• פרופילים: שמירת עוגנים ל-JSON והחלה על משקלים אחרים (דורש אותם "
            "זוגות כללים ב-GPOS).\n"
            "• תצוגה מקדימה: רינדור גס ללא HarfBuzz; אפשר השוואה לקובץ «לפני».\n"
            "• שמירה: דוח סשן ושמירה עם סיומת _with_taamim או _fixed.\n\n"
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


def _crash_log_path() -> str:
    return os.path.join(
        os.environ.get("TEMP", os.path.expanduser("~")),
        "gpos_editor_crash.txt",
    )


def _log_crash(phase: str, exc: BaseException) -> None:
    import traceback

    p = _crash_log_path()
    try:
        with open(p, "w", encoding="utf-8") as f:
            f.write(f"{phase}\n\n")
            traceback.print_exception(type(exc), exc, exc.__traceback__, file=f)
    except OSError:
        pass


def main() -> int:
    """מחזיר קוד יציאה ל-event loop. ללא sys.exit מתוך כאן — פחות סיכון לסגירה מוקדמת."""
    import traceback

    _in_qt_hook = False

    def _qt_excepthook(exc_type, exc, tb) -> None:
        nonlocal _in_qt_hook
        if exc_type is KeyboardInterrupt:
            sys.__excepthook__(exc_type, exc, tb)
            return
        if _in_qt_hook:
            sys.__excepthook__(exc_type, exc, tb)
            return
        _in_qt_hook = True
        try:
            traceback.print_exception(exc_type, exc, tb)
            try:
                if isinstance(exc, BaseException):
                    _log_crash("Uncaught exception (Qt thread)", exc)
            except Exception:
                pass
            try:
                if QApplication.instance():
                    QMessageBox.critical(
                        None,
                        "GPOS Editor — שגיאה",
                        "".join(traceback.format_exception(exc_type, exc, tb))[:4000],
                    )
            except Exception:
                pass
        finally:
            _in_qt_hook = False

    sys.excepthook = _qt_excepthook

    try:
        # לפני QApplication: מפחית חלון לבן וסגירה מיידית בחלק מכרטיסי מסך ב-Windows
        if os.environ.get("GPOS_EDITOR_NO_SOFTWARE_GL", "").lower() not in (
            "1",
            "true",
            "yes",
        ):
            try:
                QApplication.setAttribute(Qt.AA_UseSoftwareOpenGL, True)
            except Exception:
                pass
        try:
            QApplication.setAttribute(Qt.AA_DisableHighDpiScaling, True)
        except Exception:
            pass

        try:
            import faulthandler

            faulthandler.enable(all_threads=True, file=sys.stderr)
        except Exception:
            pass

        app = QApplication(sys.argv)
        app.setQuitOnLastWindowClosed(True)
        app.setStyle("Fusion")
        if os.environ.get("GPOS_EDITOR_LTR") == "1":
            app.setLayoutDirection(Qt.LeftToRight)
        else:
            app.setLayoutDirection(Qt.RightToLeft)
        try:
            w = MainWindow()
        except Exception as e:
            _log_crash("Failed while building main window (ImportTab / widgets)", e)
            traceback.print_exc()
            try:
                input(
                    "\nWindow build failed. Details saved to:\n"
                    + _crash_log_path()
                    + "\nPress Enter..."
                )
            except EOFError:
                pass
            return 1
        app._gpos_main_window = w
        w.show()
        return int(app.exec_())
    except Exception as e:
        _log_crash("Fatal error in main()", e)
        traceback.print_exc()
        print("\nSee:", _crash_log_path(), file=sys.stderr)
        try:
            input("Press Enter to close...")
        except EOFError:
            pass
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        import traceback

        traceback.print_exc()
        try:
            input("\nPress Enter to close...")
        except EOFError:
            pass
        raise SystemExit(1)
