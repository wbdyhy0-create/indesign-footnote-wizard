# -*- coding: utf-8 -*-
"""נתיבי גופנים טיפוסיים בווינדוס — לדיאלוגי פתיחת קובץ."""
from __future__ import annotations

import ctypes
import os
import sys
from typing import List


def _norm_dir(path: str) -> str:
    path = os.path.expandvars(path)
    return os.path.normpath(os.path.abspath(path))


def iter_windows_font_directories() -> List[str]:
    """רשימת תיקיות קיימות לפי סדר עדיפות (ללא כפילויות).

    תיקיית המשתמש מופיעה לפני C:\\Windows\\Fonts — שם הקבצים תמיד נספרים ב־API רגיל,
    בעוד שדיאלוג הקבצים המובנה של Windows לעיתים מציג את תיקיית המערכת כריקה.
    """
    if sys.platform != "win32":
        return []
    seen: set[str] = set()
    out: List[str] = []

    def add(raw: str) -> None:
        p = _norm_dir(raw)
        if p in seen or not os.path.isdir(p):
            return
        seen.add(p)
        out.append(p)

    # תיקיית גופנים מותאמת אישית בשורש C: (מתאים ל־search-ms עם crumb=location:C:\Fonts)
    add(r"C:\Fonts")

    local = os.environ.get("LOCALAPPDATA", "")
    if local:
        add(os.path.join(local, "Microsoft", "Windows", "Fonts"))

    userprofile = os.environ.get("USERPROFILE", "")
    if userprofile:
        add(os.path.join(userprofile, "AppData", "Local", "Microsoft", "Windows", "Fonts"))

    public = os.environ.get("PUBLIC", r"C:\Users\Public")
    add(os.path.join(public, "Documents", "Fonts"))

    windir = os.environ.get("WINDIR", r"C:\Windows")
    add(os.path.join(windir, "Fonts"))
    add(r"C:\Windows\Fonts")

    return out


def _dir_has_font_file(directory: str) -> bool:
    try:
        for name in os.listdir(directory):
            low = name.lower()
            if low.endswith((".ttf", ".otf", ".ttc")):
                return True
    except OSError:
        return False
    return False


def default_font_open_dir() -> str:
    """
    תיקיית התחלה לדיאלוג גופן: בווינדוס — תיקייה שבה יש לפחות קובץ גופן אחד,
    אחרת תיקיית המערכת הראשונה שנמצאת; אחרת תיקיית הבית.
    """
    if sys.platform == "win32":
        for d in iter_windows_font_directories():
            if _dir_has_font_file(d):
                return d
        for d in iter_windows_font_directories():
            return d
    return os.path.expanduser("~")


def is_windows_font_install_directory(dir_path: str) -> bool:
    """נתיב שבו מותקנים גופנים בווינדוס — לרוב אין לאפליקציות הרשאת כתיבה ישירה."""
    if sys.platform != "win32":
        return False
    try:
        norm = os.path.normcase(os.path.abspath(_norm_dir(dir_path)))
    except OSError:
        return False
    for fd in iter_windows_font_directories():
        try:
            fn = os.path.normcase(os.path.abspath(fd))
        except OSError:
            continue
        if norm == fn or norm.startswith(fn + os.sep):
            return True
    return False


def default_taginim_export_directory() -> str:
    """תיקיית יעד לשמירת גופן מיוצא (כתיבה למשתמש, לא תיקיית מערכת)."""
    home = os.path.expanduser("~")
    for sub in (
        "Downloads",
        "הורדות",
        "Desktop",
        "שולחן עבודה",
        "Documents",
        "מסמכים",
    ):
        p = os.path.join(home, sub)
        if os.path.isdir(p):
            return p
    ed = os.path.join(home, ".taginim_editor", "exports")
    os.makedirs(ed, exist_ok=True)
    return ed


def font_search_ms_uri() -> str:
    """חיפוש Windows במיקום C:\\Fonts.

    ללא displayname וללא & — בחלק מהמערכות מחרוזת עם crumb=location גורמת ל-Windows
    לנסות לפתוח פרוטוקול 'location:' בטעות ולהציג 'קבל אפליקציה לקישור location'.
    """
    return "search-ms:crumb=location:C%3A%5CFonts"


def font_search_ms_uri_windows_folder() -> str:
    """חיפוש במיקום תיקיית הגופנים של המערכת."""
    return "search-ms:crumb=location:C%3A%5CWindows%5CFonts"


def launch_windows_font_search(use_system_fonts_folder: bool = False) -> bool:
    """פותח חיפוש Explorer; ShellExecuteW מטפל נכון ב־search-ms (בניגוד ל־explorer argv)."""
    if sys.platform != "win32":
        return False
    uri = font_search_ms_uri_windows_folder() if use_system_fonts_folder else font_search_ms_uri()
    try:
        rc = int(
            ctypes.windll.shell32.ShellExecuteW(  # type: ignore[attr-defined]
                None,
                "open",
                uri,
                None,
                None,
                1,  # SW_SHOWNORMAL
            )
        )
        return rc > 32
    except OSError:
        try:
            os.startfile(uri)  # type: ignore[attr-defined]
            return True
        except OSError:
            return False
