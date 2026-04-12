#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
משגר שולחן עבודה: שרת Flask של export_server ברקע + חלון QWebEngineView.

כמו אפליקציית התגין — דף נטען מ־http://127.0.0.1:PORT/ (לא file://), כך שייצוא
XHR לא נתקע בבעיות מעורבת פרוטוקולים. זמן מיזוג פונטים כבדים לא מתקצר.

הרצה מתוך תיקיית standalone (או דרך run-nikkud-desktop.bat).
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path

_STANDALONE = Path(__file__).resolve().parent
if str(_STANDALONE) not in sys.path:
    sys.path.insert(0, str(_STANDALONE))

try:
    from PyQt5.QtCore import QStandardPaths, QUrl
    from PyQt5.QtWidgets import QApplication, QFileDialog, QMessageBox
    from PyQt5.QtWebEngineWidgets import QWebEngineProfile, QWebEngineView
except ImportError as e:
    print(
        "חסר PyQt5 / PyQtWebEngine.\n"
        "הריצו מתוך תיקיית standalone:\n"
        "  python -m pip install -r requirements-desktop.txt\n"
        f"({e!r})\n",
        file=sys.stderr,
    )
    try:
        input("לחצו Enter לסגירה...")
    except EOFError:
        pass
    sys.exit(1)

from werkzeug.serving import make_server

import export_server  # noqa: E402


def _start_server():
    for port in range(8765, 8800):
        try:
            srv = make_server("127.0.0.1", port, export_server.APP, threaded=True)
            return srv, port
        except OSError:
            continue
    raise RuntimeError("אין פורט פנוי בטווח 8765–8799.")


def main() -> int:
    app = QApplication(sys.argv)
    try:
        server, port = _start_server()
    except Exception as exc:
        QMessageBox.critical(None, "שרת מקומי", str(exc))
        return 1

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def _shutdown() -> None:
        try:
            server.shutdown()
        except Exception:
            pass

    app.aboutToQuit.connect(_shutdown)

    win = QWebEngineView()
    win.setWindowTitle("עורך ניקוד — שולחן עבודה")
    win.resize(1200, 820)

    def _on_download_requested(download) -> None:
        """
        Chromium ב־Qt לא תמיד שומר blob:<a download> בשקט — חובה accept + נתיב.
        פותח דיאלוג שמירה כמו בדפדפן רגיל.
        """
        suggested = (download.suggestedFileName() or "").strip()
        if not suggested:
            url = download.url().toString()
            suggested = (
                url.rsplit("/", 1)[-1].split("?", 1)[0].strip() or "download"
            )
        base = QStandardPaths.writableLocation(QStandardPaths.DownloadLocation)
        if not base:
            base = str(Path.home())
        default_path = str(Path(base) / suggested)
        path, _ = QFileDialog.getSaveFileName(
            win,
            "שמירת קובץ",
            default_path,
            "כל הקבצים (*.*)",
        )
        if path:
            download.setPath(path)
            download.accept()
        else:
            download.cancel()

    QWebEngineProfile.defaultProfile().downloadRequested.connect(
        _on_download_requested
    )

    win.load(QUrl(f"http://127.0.0.1:{port}/"))
    win.show()
    return int(app.exec_())


if __name__ == "__main__":
    raise SystemExit(main())
