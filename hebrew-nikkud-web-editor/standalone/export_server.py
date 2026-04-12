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

from flask import Flask, Response, request

APP = Flask(__name__)

STANDALONE_DIR = Path(__file__).resolve().parent
NIKKUD_EDITOR = STANDALONE_DIR.parent
REPO_ROOT = NIKKUD_EDITOR.parent
APPLY_SCRIPT = NIKKUD_EDITOR / "scripts" / "apply_nikkud_project.py"


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


if __name__ == "__main__":
    print("ייצוא פונט: POST http://127.0.0.1:8765/export")
    print(f"סקריפט יישום: {APPLY_SCRIPT}")
    APP.run(host="127.0.0.1", port=8765, debug=False)
