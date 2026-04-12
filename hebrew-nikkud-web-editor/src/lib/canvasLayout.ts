import type { Font } from "opentype.js";

export const CANVAS_W = 900;
export const CANVAS_H = 420;
export const VIEW_BASE_FONT_PX = 220;
/** מיקום קו הבסיס ביחס לגובה הקנבס */
export const BASELINE_RATIO = 0.72;

/**
 * מחשב offsets חדשים כך שמרכז תיבת הניקוד יתיישר עם מרכז תיבת האות
 * (אופקי + אנכי ביחס לגוף האות).
 */
export function computeMarkCenteredOnLetterOffsets(
  font: Font,
  baseCodePoint: number,
  mark: { codePoint: number; offsetX: number; offsetY: number },
  markDrawScale: number,
): { offsetX: number; offsetY: number } {
  const mScale = Number.isFinite(markDrawScale) && markDrawScale > 0 ? markDrawScale : 1;
  const w = CANVAS_W;
  const h = CANVAS_H;
  const scale = VIEW_BASE_FONT_PX / font.unitsPerEm;
  const markFontPx = VIEW_BASE_FONT_PX * mScale;
  const markScale = markFontPx / font.unitsPerEm;
  const baseline = h * BASELINE_RATIO;
  const baseGlyph = font.charToGlyph(String.fromCodePoint(baseCodePoint));
  const advancePx = baseGlyph.advanceWidth * scale;
  const originX = w / 2 - advancePx / 2;
  const basePath = baseGlyph.getPath(originX, baseline, VIEW_BASE_FONT_PX);
  const baseBBox = basePath.getBoundingBox();
  const anchorX = (baseBBox.x1 + baseBBox.x2) / 2;
  const anchorY = baseBBox.y1;

  const targetX = anchorX;
  const targetY = (baseBBox.y1 + baseBBox.y2) / 2;

  const g = font.charToGlyph(String.fromCodePoint(mark.codePoint));
  const ox = anchorX + mark.offsetX * markScale;
  const oy = anchorY + mark.offsetY * markScale;
  const p = g.getPath(ox, oy, markFontPx);
  const bb = p.getBoundingBox();
  const mcx = (bb.x1 + bb.x2) / 2;
  const mcy = (bb.y1 + bb.y2) / 2;
  const ddx = (targetX - mcx) / markScale;
  const ddy = (targetY - mcy) / markScale;
  return {
    offsetX: mark.offsetX + ddx,
    offsetY: mark.offsetY + ddy,
  };
}
