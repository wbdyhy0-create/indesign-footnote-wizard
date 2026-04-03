# -*- coding: utf-8 -*-
"""נתיבי גופנים טיפוסיים בווינדוס — לדיאלוגי פתיחת קובץ."""
from __future__ import annotations

import os
import subprocess
import sys
from typing import List
from urllib.parse import quote


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


def font_search_ms_uri() -> str:
    """כתובת search-ms: חיפוש בכל כונן C עם מיקום C:\\Fonts (כמו ב־Explorer של Windows)."""
    display = quote("תוצאות חיפוש ב- דיסק מקומי (C:)")
    return f"search-ms:displayname={display}&crumb=location:C%3A%5CFonts"


def launch_windows_font_search() -> bool:
    """פותח את חיפוש הקבצים של Windows עם אותו crumb כמו בכתובת search-ms."""
    if sys.platform != "win32":
        return False
    uri = font_search_ms_uri()
    try:
        subprocess.Popen(["explorer.exe", uri], close_fds=True)
        return True
    except OSError:
        try:
            os.startfile(uri)  # type: ignore[attr-defined]
            return True
        except OSError:
            return False
