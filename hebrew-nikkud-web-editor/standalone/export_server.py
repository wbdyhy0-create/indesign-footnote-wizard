#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
שרת מקומי לייצוא פונט אחרי עורך ה־standalone.

POST /export — multipart: שדה "font" (קובץ TTF/OTF), שדה "project" (JSON כמו בעורך).

דורש: pip install flask
הרצה מתוך תיקיית standalone:
  python export_server.py

שורש הריפו חייב להכיל hebrew-mark-editor ו־hebrew-nikkud-web-editor (כמו apply_nikkud_project.py).
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from flask import Flask, Response, request
except ImportError as e:
    print(
        "חסר מודול Flask.\n"
        "פתחו חלון CMD או PowerShell והריצו:\n"
        "  pip install flask\n"
        "ואז שוב: python export_server.py\n"
        "או לחצו פעמיים על run-export-server.bat בתיקייה זו.\n",
        file=sys.stderr,
    )
    print(repr(e), file=sys.stderr)
    try:
        input("\nלחצו Enter לסגירה...")
    except EOFError:
        pass
    sys.exit(1)

APP = Flask(__name__)

STANDALONE_DIR = Path(__file__).resolve().parent
NIKKUD_EDITOR = STANDALONE_DIR.parent
REPO_ROOT = NIKKUD_EDITOR.parent
APPLY_SCRIPT = NIKKUD_EDITOR / "scripts" / "apply_nikkud_project.py"
HYBRID_SCRIPT = NIKKUD_EDITOR / "scripts" / "hybrid_gpos_export.py"


def _cors(resp: Response) -> Response:
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    return resp


@APP.route("/export", methods=["OPTIONS"])
def export_options() -> Response:
    return _cors(Response("", status=204))


@APP.route("/export", methods=["POST"])
def export_font() -> Response:
    if not APPLY_SCRIPT.is_file():
        return _cors(
            Response(
                f"לא נמצא apply_nikkud_project.py ב־{APPLY_SCRIPT}",
                status=500,
                mimetype="text/plain; charset=utf-8",
            )
        )
    if "font" not in request.files or "project" not in request.files:
        return _cors(
            Response(
                'חסרים שדות multipart: "font" ו־"project"',
                status=400,
                mimetype="text/plain; charset=utf-8",
            )
        )
    font_storage = request.files["font"]
    project_storage = request.files["project"]
    font_bytes = font_storage.read()
    project_bytes = project_storage.read()
    if not font_bytes or not project_bytes:
        return _cors(
            Response("קובץ ריק", status=400, mimetype="text/plain; charset=utf-8")
        )

    orig = (font_storage.filename or "font.ttf").lower()
    suf = ".otf" if orig.endswith(".otf") else ".ttf"

    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        in_path = tdir / ("in" + suf)
        in_path.write_bytes(font_bytes)
        proj_path = tdir / "nikkud-project.json"
        proj_path.write_bytes(project_bytes)
        out_path = tdir / ("out" + suf)
        cmd = [
            sys.executable,
            str(APPLY_SCRIPT),
            "-i",
            str(in_path),
            "-p",
            str(proj_path),
            "-o",
            str(out_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO_ROOT))
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "שגיאה לא ידועה").strip()
            return _cors(
                Response(err, status=500, mimetype="text/plain; charset=utf-8")
            )
        if not out_path.is_file():
            return _cors(
                Response("לא נוצר קובץ פלט", status=500, mimetype="text/plain; charset=utf-8")
            )
        out_bytes = out_path.read_bytes()

    dl_name = "font-nikkud" + suf
    resp = Response(out_bytes, mimetype="font/ttf" if suf == ".ttf" else "font/otf")
    resp.headers["Content-Disposition"] = f'attachment; filename="{dl_name}"'
    return _cors(resp)


@APP.route("/export_hybrid", methods=["OPTIONS"])
def hybrid_options() -> Response:
    return _cors(Response("", status=204))


@APP.route("/export_hybrid", methods=["POST"])
def export_hybrid() -> Response:
    """Legacy = אותיות; Engine = GPOS + ניקוד; מיזוג glyf אותיות ואז apply JSON."""
    if not HYBRID_SCRIPT.is_file():
        return _cors(
            Response(
                f"לא נמצא hybrid_gpos_export.py ב־{HYBRID_SCRIPT}",
                status=500,
                mimetype="text/plain; charset=utf-8",
            )
        )
    for key in ("legacy", "engine", "project"):
        if key not in request.files:
            return _cors(
                Response(
                    f'חסר שדה multipart: "{key}" (נדרשים legacy, engine, project)',
                    status=400,
                    mimetype="text/plain; charset=utf-8",
                )
            )
    leg_f = request.files["legacy"]
    eng_f = request.files["engine"]
    proj_f = request.files["project"]
    leg_bytes = leg_f.read()
    eng_bytes = eng_f.read()
    proj_bytes = proj_f.read()
    if not leg_bytes or not eng_bytes or not proj_bytes:
        return _cors(
            Response("קובץ ריק", status=400, mimetype="text/plain; charset=utf-8")
        )

    def _suf(fn: str) -> str:
        low = (fn or "").lower()
        return ".otf" if low.endswith(".otf") else ".ttf"

    leg_suf = _suf(leg_f.filename or "")
    eng_suf = _suf(eng_f.filename or "")

    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        leg_path = tdir / ("legacy" + leg_suf)
        eng_path = tdir / ("engine" + eng_suf)
        leg_path.write_bytes(leg_bytes)
        eng_path.write_bytes(eng_bytes)
        proj_path = tdir / "nikkud-project.json"
        proj_path.write_bytes(proj_bytes)
        out_path = tdir / ("out" + eng_suf)
        cmd = [
            sys.executable,
            str(HYBRID_SCRIPT),
            "--legacy",
            str(leg_path),
            "--engine",
            str(eng_path),
            "--project",
            str(proj_path),
            "--output",
            str(out_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO_ROOT))
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "שגיאה לא ידועה").strip()
            return _cors(
                Response(err, status=500, mimetype="text/plain; charset=utf-8")
            )
        if not out_path.is_file():
            return _cors(
                Response("לא נוצר קובץ פלט", status=500, mimetype="text/plain; charset=utf-8")
            )
        out_bytes = out_path.read_bytes()

    dl_name = "font-nikkud-hybrid" + eng_suf
    resp = Response(
        out_bytes, mimetype="font/ttf" if eng_suf == ".ttf" else "font/otf"
    )
    resp.headers["Content-Disposition"] = f'attachment; filename="{dl_name}"'
    return _cors(resp)


def _pause_exit(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    try:
        input("\nלחצו Enter לסגירה...")
    except EOFError:
        pass
    sys.exit(code)


if __name__ == "__main__":
    print("ייצוא רגיל: POST http://127.0.0.1:8765/export")
    print("ייצוא היברידי: POST http://127.0.0.1:8765/export_hybrid")
    print(f"סקריפט יישום: {APPLY_SCRIPT}")
    print(f"סקריפט היברידי: {HYBRID_SCRIPT}")
    print("השארו את החלון פתוח — סגירה עוצרת את השרת.\n")
    try:
        APP.run(host="127.0.0.1", port=8765, debug=False)
    except OSError as e:
        if "10048" in str(e) or "address already in use" in str(e).lower():
            _pause_exit(
                "הפורט 8765 תפוס. סגרו תוכנה אחרת על אותו פורט או שינו פורט בקובץ export_server.py"
            )
        _pause_exit(str(e))
