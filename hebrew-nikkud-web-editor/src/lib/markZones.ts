import type { MarkZone } from "../types";

/** סיווג גס לסימני ניקוד/טעם — לסדר שכבות ולמנוע חפיפה דגש/ניקוד */
export function markZoneForCodePoint(cp: number): MarkZone {
  if (cp === 0x05bc || cp === 0x05bf) return "center"; // דגש / רפה
  if (cp === 0x05bd) return "meteg"; // מטר

  // חולם ונגזרות — מעל
  if (cp === 0x05b9 || cp === 0x05ba) return "upper";

  // ניקוד תחתון נפוץ (יחסית לגוף האות)
  const mostlyLower = new Set<number>([
    0x05b0, 0x05b1, 0x05b2, 0x05b3, 0x05b4, 0x05b5, 0x05b6, 0x05b7, 0x05b8, 0x05bb,
    0x05c7,
  ]);
  if (mostlyLower.has(cp)) return "lower";

  // טעמים (0591–05AF): ברירת מחדל "upper"; חלקם נמוך יותר
  if (cp >= 0x0591 && cp <= 0x05af) {
    const lowerCant = new Set<number>([
      0x05a0, 0x05a1, 0x05a2, 0x05a3, 0x05a4, 0x05a5, 0x05a6,
    ]);
    if (lowerCant.has(cp)) return "lower";
    return "upper";
  }

  return "upper";
}

/** סדר ציור: פנימי לפני חיצוני */
export function markLayerOrder(zone: MarkZone): number {
  switch (zone) {
    case "center":
      return 0;
    case "meteg":
      return 1;
    case "lower":
      return 2;
    case "upper":
      return 3;
    default:
      return 2;
  }
}
