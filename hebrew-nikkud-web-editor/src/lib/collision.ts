import type { MarkInstance } from "../types";
import { markZoneForCodePoint } from "./markZones";

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** מרכז bbox ומרחיב לרוחב/גובה מינימליים — שימושי לבדיקת היט על ניקוד קטן בקנבס */
export function expandBBoxToMinSide(bb: BBox, minSide: number): BBox {
  const w = bb.x2 - bb.x1;
  const h = bb.y2 - bb.y1;
  const cx = (bb.x1 + bb.x2) / 2;
  const cy = (bb.y1 + bb.y2) / 2;
  const ew = Math.max(w, minSide);
  const eh = Math.max(h, minSide);
  return { x1: cx - ew / 2, y1: cy - eh / 2, x2: cx + ew / 2, y2: cy + eh / 2 };
}

export function bboxOverlap(a: BBox, b: BBox, pad = 2): boolean {
  return (
    a.x1 - pad < b.x2 + pad &&
    a.x2 + pad > b.x1 - pad &&
    a.y1 - pad < b.y2 + pad &&
    a.y2 + pad > b.y1 - pad
  );
}

/**
 * מזיז ניקוד "חיצוני" מעלה (offsetY קטן יותר) אם ה-bbox שלו חופף לדגש/מרכז.
 * מעבר אחד — אחרי שינוי offsets יש לצייר מחדש ולהריץ שוב אם צריך.
 */
export function nudgeOutOfCenterOverlap(
  marks: MarkInstance[],
  boxes: Map<string, BBox>,
  step = 10,
): MarkInstance[] {
  const centerBoxes: BBox[] = [];
  for (const m of marks) {
    if (markZoneForCodePoint(m.codePoint) !== "center") continue;
    const b = boxes.get(m.id);
    if (b) centerBoxes.push(b);
  }
  if (!centerBoxes.length) return marks;

  return marks.map((m) => {
    if (markZoneForCodePoint(m.codePoint) === "center") return m;
    const b = boxes.get(m.id);
    if (!b) return m;
    let dy = 0;
    for (const c of centerBoxes) {
      if (bboxOverlap(b, c)) dy -= step;
    }
    if (dy === 0) return m;
    return { ...m, offsetY: m.offsetY + dy };
  });
}
