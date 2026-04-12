import type { Font, Path } from "opentype.js";
import type { BBox } from "./collision";

type MarkGeom =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "path"; path: Path };

function isHebrewMarkCodePoint(cp: number): boolean {
  return cp >= 0x0591 && cp <= 0x05c7;
}

/**
 * כשאין גליף אמיתי (notdef) או כשהפונט משרטט ריבוע קטן — נציג עיגול במקום.
 */
export function shouldDrawHebrewMarkAsCircle(
  g: { index?: number },
  codePoint: number,
  stubBbox: BBox,
  markFontPx: number,
): boolean {
  if (!isHebrewMarkCodePoint(codePoint)) return false;
  if ((g.index ?? -1) === 0) return true;
  const bw = stubBbox.x2 - stubBbox.x1;
  const bh = stubBbox.y2 - stubBbox.y1;
  if (bw < 4 || bh < 4) return true;
  const aspect = bw / Math.max(bh, 0.01);
  if (aspect < 0.9 || aspect > 1.11) return false;
  return bw < markFontPx * 0.34 && bh < markFontPx * 0.34;
}

export function markGeometry(
  font: Font,
  codePoint: number,
  ox: number,
  oy: number,
  markFontPx: number,
): MarkGeom {
  const g = font.charToGlyph(String.fromCodePoint(codePoint));
  const stubPath = g.getPath(ox, oy, markFontPx);
  const stubBb = stubPath.getBoundingBox();
  if (shouldDrawHebrewMarkAsCircle(g, codePoint, stubBb, markFontPx)) {
    const cx = (stubBb.x1 + stubBb.x2) / 2;
    const cy = (stubBb.y1 + stubBb.y2) / 2;
    const r = Math.max(
      markFontPx * 0.09,
      Math.min(stubBb.x2 - stubBb.x1, stubBb.y2 - stubBb.y1) * 0.48,
    );
    return { kind: "circle", cx, cy, r: r };
  }
  return { kind: "path", path: stubPath };
}

export function bboxForMarkGeometry(geom: MarkGeom): BBox {
  if (geom.kind === "circle") {
    const { cx, cy, r } = geom;
    return { x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r };
  }
  return geom.path.getBoundingBox();
}

export function drawHebrewMarkWithFallback(
  ctx: CanvasRenderingContext2D,
  font: Font,
  codePoint: number,
  ox: number,
  oy: number,
  markFontPx: number,
  fill: string,
): BBox {
  const geom = markGeometry(font, codePoint, ox, oy, markFontPx);
  if (geom.kind === "circle") {
    ctx.beginPath();
    ctx.arc(geom.cx, geom.cy, geom.r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    return bboxForMarkGeometry(geom);
  }
  geom.path.fill = fill;
  geom.path.draw(ctx);
  return geom.path.getBoundingBox();
}

export function hitTestHebrewMark(
  font: Font,
  codePoint: number,
  ox: number,
  oy: number,
  markFontPx: number,
  sx: number,
  sy: number,
): boolean {
  const geom = markGeometry(font, codePoint, ox, oy, markFontPx);
  const bb = bboxForMarkGeometry(geom);
  return sx >= bb.x1 && sx <= bb.x2 && sy >= bb.y1 && sy <= bb.y2;
}
