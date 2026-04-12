import { useEffect, useRef } from "react";
import type { Font } from "opentype.js";
import type { MarkInstance } from "../types";
import { markLayerOrder, markZoneForCodePoint } from "../lib/markZones";
import type { BBox } from "../lib/collision";
import { drawAnchorGuides, drawPixelGrid } from "../lib/canvasGrid";

const VIEW_FONT_PX = 220;

export interface EditorCanvasProps {
  font: Font | null;
  baseCodePoint: number;
  marks: MarkInstance[];
  selectedMarkId: string | null;
  onSelectMark: (id: string | null) => void;
  onBoxesMeasured?: (boxes: Map<string, BBox>) => void;
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
  showGrid = true,
  gridMinorPx = 10,
  gridMajorPx = 50,
  showAnchorGuides = true,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const scale = VIEW_FONT_PX / font.unitsPerEm;
    const baseline = h * 0.72;
    const baseChar = String.fromCodePoint(baseCodePoint);
    const baseGlyph = font.charToGlyph(baseChar);
    const advancePx = baseGlyph.advanceWidth * scale;
    const originX = w / 2 - advancePx / 2;

    const basePath = baseGlyph.getPath(originX, baseline, VIEW_FONT_PX);
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
      const ch = String.fromCodePoint(m.codePoint);
      const g = font.charToGlyph(ch);
      const ox = anchorX + m.offsetX * scale;
      const oy = anchorY + m.offsetY * scale;
      const p = g.getPath(ox, oy, VIEW_FONT_PX);
      const isSel = m.id === selectedMarkId;
      p.fill = isSel ? "#1d4ed8" : "#991b1b";
      p.draw(ctx);
      boxes.set(m.id, p.getBoundingBox());
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
  ]);

  const handleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (!font) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const scale = canvas.width / rect.width;
    const sx = x * scale;
    const sy = y * scale;

    const hit = hitTestMarks(canvasRef.current, font, baseCodePoint, marks, sx, sy);
    onSelectMark(hit);
  };

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={420}
      className="editor-canvas"
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
): string | null {
  if (!canvas) return null;
  const w = canvas.width;
  const h = canvas.height;
  const scale = VIEW_FONT_PX / font.unitsPerEm;
  const baseline = h * 0.72;
  const baseGlyph = font.charToGlyph(String.fromCodePoint(baseCodePoint));
  const advancePx = baseGlyph.advanceWidth * scale;
  const originX = w / 2 - advancePx / 2;
  const basePath = baseGlyph.getPath(originX, baseline, VIEW_FONT_PX);
  const baseBBox = basePath.getBoundingBox();
  const anchorX = (baseBBox.x1 + baseBBox.x2) / 2;
  const anchorY = baseBBox.y1;

  const sorted = sortMarksForDraw(marks).reverse();
  for (const m of sorted) {
    const g = font.charToGlyph(String.fromCodePoint(m.codePoint));
    const ox = anchorX + m.offsetX * scale;
    const oy = anchorY + m.offsetY * scale;
    const p = g.getPath(ox, oy, VIEW_FONT_PX);
    const bb = p.getBoundingBox();
    if (sx >= bb.x1 && sx <= bb.x2 && sy >= bb.y1 && sy <= bb.y2) return m.id;
  }
  return null;
}
