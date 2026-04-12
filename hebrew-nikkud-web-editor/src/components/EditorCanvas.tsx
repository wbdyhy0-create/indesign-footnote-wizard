import { useEffect, useRef } from "react";
import type { Font } from "opentype.js";
import type { MarkInstance } from "../types";
import { markLayerOrder, markZoneForCodePoint } from "../lib/markZones";
import type { BBox } from "../lib/collision";
import { drawAnchorGuides, drawPixelGrid } from "../lib/canvasGrid";
import {
  BASELINE_RATIO,
  CANVAS_H,
  CANVAS_W,
  VIEW_BASE_FONT_PX,
} from "../lib/canvasLayout";
import { drawHebrewMarkWithFallback, hitTestHebrewMark } from "../lib/canvasMarkFallback";

export interface EditorCanvasProps {
  font: Font | null;
  baseCodePoint: number;
  marks: MarkInstance[];
  selectedMarkId: string | null;
  onSelectMark: (id: string | null) => void;
  onBoxesMeasured?: (boxes: Map<string, BBox>) => void;
  /** מקדם לגודל ציור ניקוד ביחס לאות (1 = ברירת מחדל; גדול מ־1 לגופן עבה) */
  markDrawScale?: number;
  /** הגדלת תצוגת הקנבס (רוחב/גובה CSS; הקואורדינטות הפנימיות נשארות קבועות) */
  displayScale?: number;
  /** רשת פיקסלים (עדינה + קווים חזקים כל majorPx) */
  showGrid?: boolean;
  /** מרווח רשת עדינה בפיקסלים */
  gridMinorPx?: number;
  /** מרווח קווים בולטים יותר (מומלץ כפולה של minor) */
  gridMajorPx?: number;
  /** קו אנכי במרכז האות + קו אופקי בעוגן הניקוד */
  showAnchorGuides?: boolean;
}

function sortMarksForDraw(marks: MarkInstance[]): MarkInstance[] {
  return [...marks].sort(
    (a, b) =>
      markLayerOrder(markZoneForCodePoint(a.codePoint)) -
      markLayerOrder(markZoneForCodePoint(b.codePoint)),
  );
}

export function EditorCanvas({
  font,
  baseCodePoint,
  marks,
  selectedMarkId,
  onSelectMark,
  onBoxesMeasured,
  markDrawScale = 1,
  displayScale = 1,
  showGrid = true,
  gridMinorPx = 10,
  gridMajorPx = 50,
  showAnchorGuides = true,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mScale = Number.isFinite(markDrawScale) && markDrawScale > 0 ? markDrawScale : 1;
  const dScale = Number.isFinite(displayScale) && displayScale > 0 ? displayScale : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, w, h);

    if (showGrid) {
      drawPixelGrid(ctx, w, h, gridMinorPx, gridMajorPx);
    }

    if (!font) {
      ctx.fillStyle = "#71717a";
      ctx.font = "18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("טען גופן כדי להציג תצוגה", w / 2, h / 2);
      onBoxesMeasured?.(new Map());
      return;
    }

    const scale = VIEW_BASE_FONT_PX / font.unitsPerEm;
    const markFontPx = VIEW_BASE_FONT_PX * mScale;
    const markScale = markFontPx / font.unitsPerEm;
    const baseline = h * BASELINE_RATIO;
    const baseChar = String.fromCodePoint(baseCodePoint);
    const baseGlyph = font.charToGlyph(baseChar);
    const advancePx = baseGlyph.advanceWidth * scale;
    const originX = w / 2 - advancePx / 2;

    const basePath = baseGlyph.getPath(originX, baseline, VIEW_BASE_FONT_PX);
    basePath.fill = "#18181b";
    basePath.draw(ctx);

    const baseBBox = basePath.getBoundingBox();
    const anchorX = (baseBBox.x1 + baseBBox.x2) / 2;
    const anchorY = baseBBox.y1;

    if (showAnchorGuides) {
      drawAnchorGuides(ctx, w, h, anchorX, anchorY);
    }

    const boxes = new Map<string, BBox>();
    const sorted = sortMarksForDraw(marks);

    for (const m of sorted) {
      const ox = anchorX + m.offsetX * markScale;
      const oy = anchorY + m.offsetY * markScale;
      const isSel = m.id === selectedMarkId;
      const fill = isSel ? "#1d4ed8" : "#991b1b";
      const bb = drawHebrewMarkWithFallback(
        ctx,
        font,
        m.codePoint,
        ox,
        oy,
        markFontPx,
        fill,
      );
      boxes.set(m.id, bb);
    }

    ctx.strokeStyle = "#d4d4d8";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(w * 0.08, baseline);
    ctx.lineTo(w * 0.92, baseline);
    ctx.stroke();
    ctx.setLineDash([]);

    onBoxesMeasured?.(boxes);
  }, [
    font,
    baseCodePoint,
    marks,
    selectedMarkId,
    onBoxesMeasured,
    showGrid,
    gridMinorPx,
    gridMajorPx,
    showAnchorGuides,
    markDrawScale,
  ]);

  const handleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!font) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const scalePx = canvas.width / rect.width;
    const sx = x * scalePx;
    const sy = y * scalePx;

    const hit = hitTestMarks(
      canvasRef.current,
      font,
      baseCodePoint,
      marks,
      sx,
      sy,
      mScale,
    );
    onSelectMark(hit);
  };

  const dw = CANVAS_W * dScale;
  const dh = CANVAS_H * dScale;

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="editor-canvas"
      style={{ width: dw, height: dh, display: "block", maxWidth: "100%" }}
      onClick={handleClick}
      role="img"
      aria-label="תצוגת אות וניקוד"
    />
  );
}

function hitTestMarks(
  canvas: HTMLCanvasElement | null,
  font: Font,
  baseCodePoint: number,
  marks: MarkInstance[],
  sx: number,
  sy: number,
  markDrawScale: number,
): string | null {
  if (!canvas) return null;
  const w = canvas.width;
  const h = canvas.height;
  const scale = VIEW_BASE_FONT_PX / font.unitsPerEm;
  const markFontPx = VIEW_BASE_FONT_PX * markDrawScale;
  const markScale = markFontPx / font.unitsPerEm;
  const baseline = h * BASELINE_RATIO;
  const baseGlyph = font.charToGlyph(String.fromCodePoint(baseCodePoint));
  const advancePx = baseGlyph.advanceWidth * scale;
  const originX = w / 2 - advancePx / 2;
  const basePath = baseGlyph.getPath(originX, baseline, VIEW_BASE_FONT_PX);
  const baseBBox = basePath.getBoundingBox();
  const anchorX = (baseBBox.x1 + baseBBox.x2) / 2;
  const anchorY = baseBBox.y1;

  const sorted = sortMarksForDraw(marks).reverse();
  for (const m of sorted) {
    const ox = anchorX + m.offsetX * markScale;
    const oy = anchorY + m.offsetY * markScale;
    if (hitTestHebrewMark(font, m.codePoint, ox, oy, markFontPx, sx, sy)) return m.id;
  }
  return null;
}
