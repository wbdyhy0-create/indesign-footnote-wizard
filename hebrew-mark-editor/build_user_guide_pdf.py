#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build GPOS_EDITOR_USER_GUIDE.pdf from GPOS_EDITOR_USER_GUIDE.md

Requires: pip install fpdf2
Run from hebrew-mark-editor:  py -3.12 build_user_guide_pdf.py
"""

from __future__ import annotations

import os
import re
import sys

try:
    from fpdf import FPDF
except ImportError:
    print("Install: pip install fpdf2", file=sys.stderr)
    sys.exit(1)

try:
    # Proper RTL display (Hebrew) in PDF text runs
    from bidi.algorithm import get_display  # type: ignore
except Exception:
    get_display = None

ROOT = os.path.dirname(os.path.abspath(__file__))
MD_PATH = os.path.join(ROOT, "GPOS_EDITOR_USER_GUIDE.md")
PDF_PATH = os.path.join(ROOT, "GPOS_EDITOR_USER_GUIDE.pdf")
PDF_FALLBACK_PATH = os.path.join(ROOT, "GPOS_EDITOR_USER_GUIDE_rtl.pdf")


def _font_paths() -> tuple[str | None, str | None]:
    """Regular and bold TTF (bold optional)."""
    w = os.environ.get("WINDIR", r"C:\Windows")
    fonts = os.path.join(w, "Fonts")
    reg = None
    for name in ("arial.ttf", "Arial.ttf"):
        p = os.path.join(fonts, name)
        if os.path.isfile(p):
            reg = p
            break
    bold = os.path.join(fonts, "arialbd.ttf")
    if not os.path.isfile(bold):
        bold = os.path.join(fonts, "Arialbd.ttf")
    if not os.path.isfile(bold):
        bold = None
    return reg, bold


def _strip_inline_md(s: str) -> str:
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = s.replace("\u2713", "[ok]").replace("\u2717", "[no]")
    return s


def _rtl(s: str) -> str:
    """Convert logical Hebrew string to visual RTL for PDF rendering."""
    if not s:
        return s
    if get_display is None:
        return s  # fallback (may appear reversed)
    # Keep LTR "islands" (Windows, file names, versions) readable inside RTL lines.
    lrm = "\u200E"  # Left-to-Right Mark
    wrapped = re.sub(r"([A-Za-z0-9_./:\\-]+)", lambda m: f"{lrm}{m.group(1)}{lrm}", s)
    return get_display(wrapped, base_dir="R")


def main() -> int:
    font_path, bold_path = _font_paths()
    if not font_path:
        print("Arial not found under WINDIR/Fonts.", file=sys.stderr)
        return 1
    if not os.path.isfile(MD_PATH):
        print("Missing:", MD_PATH, file=sys.stderr)
        return 1

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=14)
    m = 14
    pdf.set_margins(m, m, m)
    pdf.add_page()
    pdf.add_font("Hebrew", "", font_path)
    if bold_path:
        pdf.add_font("Hebrew", "B", bold_path)
    pdf.set_font("Hebrew", size=11)
    tw = pdf.epw

    in_code = False

    with open(MD_PATH, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\r\n")

            if line.strip() == "```text":
                in_code = True
                pdf.ln(2)
                pdf.set_font("Hebrew", size=9)
                continue
            if in_code:
                if line.strip().startswith("```"):
                    in_code = False
                    pdf.set_font("Hebrew", size=11)
                    pdf.ln(3)
                else:
                    pdf.multi_cell(tw, 5, line, align="L")
                continue

            if re.match(r"^\|?\s*-{3,}", line.replace("|", "").strip()):
                continue
            if line.strip().startswith("|") and "|" in line[1:]:
                parts = [p.strip() for p in line.split("|")]
                parts = [p for p in parts if p]
                if len(parts) >= 2:
                    joined = "   |   ".join(_strip_inline_md(p) for p in parts)
                    pdf.set_font("Hebrew", size=10)
                    pdf.multi_cell(tw, 6, joined, align="R")
                    pdf.set_font("Hebrew", size=11)
                continue

            if line.strip() == "---":
                pdf.ln(2)
                y = pdf.get_y()
                pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
                pdf.ln(4)
                continue

            if not line.strip():
                pdf.ln(2)
                continue

            s = _strip_inline_md(line)
            s = _rtl(s)

            if s.startswith("# "):
                pdf.set_font("Hebrew", size=18)
                pdf.multi_cell(tw, 9, s[2:], align="R")
                pdf.set_font("Hebrew", size=11)
                pdf.ln(2)
            elif s.startswith("## "):
                pdf.set_font("Hebrew", size=14)
                pdf.multi_cell(tw, 8, s[3:], align="R")
                pdf.set_font("Hebrew", size=11)
                pdf.ln(2)
            elif s.startswith("### "):
                if bold_path:
                    pdf.set_font("Hebrew", style="B", size=12)
                else:
                    pdf.set_font("Hebrew", size=12)
                pdf.multi_cell(tw, 7, s[4:], align="R")
                pdf.set_font("Hebrew", style="", size=11)
                pdf.ln(1)
            elif s.startswith("#### "):
                if bold_path:
                    pdf.set_font("Hebrew", style="B", size=11)
                else:
                    pdf.set_font("Hebrew", size=11)
                pdf.multi_cell(tw, 6, s[5:], align="R")
                pdf.set_font("Hebrew", style="", size=11)
                pdf.ln(1)
            elif s.startswith("- "):
                pdf.multi_cell(tw, 6, _rtl("• " + s[2:]), align="R")
            elif re.match(r"^\d+\.\s", s):
                pdf.multi_cell(tw, 6, s, align="R")
            elif s.startswith("*") and s.endswith("*") and len(s) > 2:
                pdf.set_font("Hebrew", size=9)
                pdf.multi_cell(tw, 5, s.strip("*"), align="R")
                pdf.set_font("Hebrew", size=11)
            else:
                pdf.multi_cell(tw, 6, s, align="R")

    def _first_writable_path(preferred: str, fallback: str) -> str:
        try_paths = [preferred, fallback]
        if os.path.isfile(fallback):
            # If fallback exists and is locked, keep generating a new numbered file.
            base, ext = os.path.splitext(fallback)
            for i in range(2, 50):
                try_paths.append(f"{base}{i}{ext}")
        for p in try_paths:
            try:
                pdf.output(p)
                return p
            except PermissionError:
                continue
        # Last resort: re-raise the original preferred error
        pdf.output(preferred)
        return preferred

    out_path = _first_writable_path(PDF_PATH, PDF_FALLBACK_PATH)
    print("Wrote:", out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
