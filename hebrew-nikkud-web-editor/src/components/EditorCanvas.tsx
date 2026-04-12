import { useEffect, useRef } from "react";
import type { Font, Path } from "opentype.js";
import type { MarkInstance } from "../types";
import { markLayerOrder, markZoneForCodePoint } from "../lib/markZones";
import { expandBBoxToMinSide, type BBox } from "../lib/collision";
import {
  drawAnchorGuides,
  drawPixelGrid,
  type PixelGridBelowLetterOpts,
} from "../lib/canvasGrid";
import {
  BASELINE_RATIO,
  CANVAS_H,
  CANVAS_W,
  VIEW_BASE_FONT_PX,
} from "../lib/canvasLayout";
import {
  bboxForMarkGeometry,
  drawHebrewMarkWithFallback,
  markGeometry,
} from "../lib/canvasMarkFallback";

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

    let basePathForLetter: Path | null = null;
    let baseline = 0;
    let markFontPx = 0;
    let markScale = 0;
    let anchorX = w / 2;
    let anchorY = 0;

    if (font) {
      const scale = VIEW_BASE_FONT_PX / font.unitsPerEm;
      markFontPx = VIEW_BASE_FONT_PX * mScale;
      markScale = markFontPx / font.unitsPerEm;
      baseline = h * BASELINE_RATIO;
      const baseGlyph = font.charToGlyph(String.fromCodePoint(baseCodePoint));
      const advancePx = baseGlyph.advanceWidth * scale;
      const originX = w / 2 - advancePx / 2;
      basePathForLetter = baseGlyph.getPath(originX, baseline, VIEW_BASE_FONT_PX);
      const baseBBox = basePathForLetter.getBoundingBox();
      anchorX = (baseBBox.x1 + baseBBox.x2) / 2;
      anchorY = baseBBox.y1;

      if (showGrid) {
        const minor = Math.max(2, Math.round(gridMinorPx));
        const yRowTop = Math.floor(baseBBox.y2 / minor) * minor + minor;
        let band: PixelGridBelowLetterOpts | null = null;
        if (yRowTop < h) {
          band = { yRowTop, x1: baseBBox.x1, x2: baseBBox.x2 };
        }
        drawPixelGrid(ctx, w, h, gridMinorPx, gridMajorPx, band);
      }
    } else if (showGrid) {
      drawPixelGrid(ctx, w, h, gridMinorPx, gridMajorPx, null);
    }

    if (!font) {
      ctx.fillStyle = "#71717a";
      ctx.font = "18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("טען גופן כדי להציג תצוגה", w / 2, h / 2);
      onBoxesMeasured?.(new Map());
      return;
    }

    basePathForLetter!.fill = "#18181b";
    basePathForLetter!.draw(ctx);

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

  const sorted = sortMarksForDraw(marks);
  const topFirst = [...sorted].reverse();
  /** אזור קליק מינימלי — ב־100% ניקוד קטן מאוד; בלי זה צריך ~155% כדי שיתפוס בקליק */
  const minHitSidePx = 44;
  /** כמה סימונים עם bbox חופף (לאחר הרחבה להיט) לקליק; נבחר לפי שטח bbox הציור (לא המורחב) ואז שכבה */
  const hits: { id: string; area: number; revIdx: number }[] = [];
  topFirst.forEach((m, revIdx) => {
    const ox = anchorX + m.offsetX * markScale;
    const oy = anchorY + m.offsetY * markScale;
    const geom = markGeometry(font, m.codePoint, ox, oy, markFontPx);
    const bbRaw = bboxForMarkGeometry(geom);
    const bbHit = expandBBoxToMinSide(bbRaw, minHitSidePx);
    if (sx < bbHit.x1 || sx > bbHit.x2 || sy < bbHit.y1 || sy > bbHit.y2) return;
    const area = Math.max(1e-6, (bbRaw.x2 - bbRaw.x1) * (bbRaw.y2 - bbRaw.y1));
    hits.push({ id: m.id, area, revIdx });
  });
  if (!hits.length) return null;
  hits.sort((a, b) => a.area - b.area || a.revIdx - b.revIdx);
  return hits[0].id;
}
