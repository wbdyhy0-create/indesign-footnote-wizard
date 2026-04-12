#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
שרת מקומי לייצוא פונט אחרי עורך ה־standalone.

POST /export — multipart: שדה "font" (קובץ TTF/OTF), שדה "project" (JSON כמו בעורך).

דורש: pip install flask
הרצה מתוך תיקיית standalone:
  python export_server.py

לחלון אחד (דפדפן מובנה + שרת, בלי file://): run-nikkud-desktop.bat או python nikkud_desktop_launcher.py

שורש הריפו חייב להכיל hebrew-mark-editor ו־hebrew-nikkud-web-editor (כמו apply_nikkud_project.py).
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


def _tail_text_file(path: Path, max_chars: int = 12000) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")[-max_chars:]


def _run_script_logged(
    cmd: list[str],
    *,
    cwd: Path,
    log_path: Path,
    timeout: int = 900,
) -> tuple[int, str]:
    """
    מריץ סקריפט Python; כל הפלט לקובץ (מונע תקיעה מניפוי capture_output שמתמלא).
    מחזיר (returncode, זנב לוג לטקסט שגיאה).
    """
    with open(log_path, "wb") as logf:
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(cwd),
                stdout=logf,
                stderr=subprocess.STDOUT,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return -1, _tail_text_file(log_path)
    return proc.returncode, _tail_text_file(log_path)


class _TeeBinary:
    """כותב stdout של תהליך גם לקובץ וגם ל־stderr של השרת (חלון CMD) בזמן אמת."""

    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        if isinstance(data, str):
            data = data.encode("utf-8", errors="replace")
        for st in self.streams:
            st.write(data)
            st.flush()
        return len(data)

    def flush(self) -> None:
        for st in self.streams:
            st.flush()


def _run_hybrid_script_logged(
    cmd: list[str],
    *,
    cwd: Path,
    log_path: Path,
    timeout: int = 1200,
) -> tuple[int, str]:
    """ייצוא היברידי: לוג לקובץ + שורות [hybrid] בזמן אמת לחלון השרת."""
    with open(log_path, "wb") as logf:
        tee = _TeeBinary(logf, sys.stderr.buffer)
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(cwd),
                stdout=tee,
                stderr=subprocess.STDOUT,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            return -1, _tail_text_file(log_path)
    return proc.returncode, _tail_text_file(log_path)

try:
    from flask import Flask, Response, request, send_file
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
# פונטים + JSON — גבול גבוה כדי שלא ייחתך בשקט
APP.config["MAX_CONTENT_LENGTH"] = 512 * 1024 * 1024

STANDALONE_DIR = Path(__file__).resolve().parent
INDEX_HTML = STANDALONE_DIR / "index.html"
NIKKUD_EDITOR = STANDALONE_DIR.parent
REPO_ROOT = NIKKUD_EDITOR.parent
APPLY_SCRIPT = NIKKUD_EDITOR / "scripts" / "apply_nikkud_project.py"
HYBRID_SCRIPT = NIKKUD_EDITOR / "scripts" / "hybrid_gpos_export.py"


def _cors(resp: Response) -> Response:
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    return resp


@APP.get("/")
def serve_index() -> Response:
    """ממשק העורך מאותו מקור כמו הייצוא — מונע תקיעות fetch מ־file:// ל־localhost."""
    if not INDEX_HTML.is_file():
        return Response(
            f"לא נמצא index.html ב־{INDEX_HTML}",
            status=404,
            mimetype="text/plain; charset=utf-8",
        )
    return send_file(INDEX_HTML, mimetype="text/html; charset=utf-8")


@APP.route("/ping", methods=["GET", "OPTIONS"])
def ping() -> Response:
    """בדיקת חיבור מהירה מהדפדפן לפני ייצוא כבד."""
    if request.method == "OPTIONS":
        return _cors(Response("", status=204))
    return _cors(Response("ok\n", mimetype="text/plain; charset=utf-8"))


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
        log_path = tdir / "export-subprocess.log"
        code, log_tail = _run_script_logged(
            cmd, cwd=REPO_ROOT, log_path=log_path, timeout=900
        )
        if code != 0:
            err = (
                f"פג זמן (15 דקות) או שגיאה — קוד {code}.\n{log_tail}".strip()
                if code == -1
                else (log_tail.strip() or "שגיאה לא ידועה")
            )
            return _cors(
                Response(err, status=504 if code == -1 else 500, mimetype="text/plain; charset=utf-8")
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
    print("export_hybrid: התחלה", flush=True)
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
    export_font_name = (request.form.get("export_font_name") or "").strip()
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
        if export_font_name:
            cmd.extend(["--export-font-name", export_font_name])
        log_path = tdir / "export-hybrid.log"
        code, log_tail = _run_hybrid_script_logged(
            cmd, cwd=REPO_ROOT, log_path=log_path, timeout=1200
        )
        if code != 0:
            err = (
                f"פג זמן (20 דקות) או שגיאה — קוד {code}.\n{log_tail}".strip()
                if code == -1
                else (log_tail.strip() or "שגיאה לא ידועה")
            )
            print(f"export_hybrid: נכשל קוד={code}", flush=True)
            return _cors(
                Response(
                    err,
                    status=504 if code == -1 else 500,
                    mimetype="text/plain; charset=utf-8",
                )
            )
        if not out_path.is_file():
            return _cors(
                Response("לא נוצר קובץ פלט", status=500, mimetype="text/plain; charset=utf-8")
            )
        out_bytes = out_path.read_bytes()
        print("export_hybrid: הצלחה", flush=True)

    def _safe_dl_base(s: str) -> str:
        b = "".join(c for c in s if c.isalnum() or c in "._- ")
        b = (b or "font-nikkud-hybrid").strip().replace(" ", "-")[:120]
        return b

    dl_name = _safe_dl_base(export_font_name) + eng_suf if export_font_name else "font-nikkud-hybrid" + eng_suf
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
    print("ממשק עורך (מומלץ): http://127.0.0.1:8765/")
    print("בדיקת חיבור: GET http://127.0.0.1:8765/ping")
    print("ייצוא רגיל: POST http://127.0.0.1:8765/export")
    print("ייצוא היברידי: POST http://127.0.0.1:8765/export_hybrid")
    print(f"סקריפט יישום: {APPLY_SCRIPT}")
    print(f"סקריפט היברידי: {HYBRID_SCRIPT}")
    print("השארו את החלון פתוח — סגירה עוצרת את השרת.\n")
    try:
        APP.run(host="127.0.0.1", port=8765, debug=False, threaded=True)
    except OSError as e:
        if "10048" in str(e) or "address already in use" in str(e).lower():
            _pause_exit(
                "הפורט 8765 תפוס. סגרו תוכנה אחרת על אותו פורט או שינו פורט בקובץ export_server.py"
            )
        _pause_exit(str(e))
