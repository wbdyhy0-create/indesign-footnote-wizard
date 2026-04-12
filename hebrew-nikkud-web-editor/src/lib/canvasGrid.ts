/** שורת רשת ראשונה מתחת לאות — קווי תאים בולטים רק בפס אנכי זה */
export type PixelGridBelowLetterOpts = {
  yRowTop: number;
  x1: number;
  x2: number;
};

/** רשת פיקסלים לדיוק — מצוירת לפני הגליפים */
export function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  minorPx: number,
  majorPx: number,
  belowLetter?: PixelGridBelowLetterOpts | null,
): void {
  const minor = Math.max(2, Math.round(minorPx));
  const major = Math.max(minor, Math.round(majorPx));

  ctx.save();
  ctx.lineWidth = 1;

  const majorStroke = "rgba(39, 39, 42, 0.34)";
  /** קווים דקים — גוון כחלחל כדי להבדיל מהעבים; אלפא גבוהה יותר מלפני לנראות על רקע בהיר */
  const minorStroke = "rgba(99, 102, 241, 0.26)";

  for (let x = 0; x <= w; x += minor) {
    const isMajor = x % major === 0;
    ctx.strokeStyle = isMajor ? majorStroke : minorStroke;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }

  for (let y = 0; y <= h; y += minor) {
    const isMajor = y % major === 0;
    ctx.strokeStyle = isMajor ? majorStroke : minorStroke;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }

  if (belowLetter) {
    const { yRowTop, x1, x2 } = belowLetter;
    if (yRowTop >= 0 && yRowTop < h) {
      const accent = "rgba(29, 78, 216, 0.92)";
      const xLo = Math.max(0, Math.min(x1, x2) - minor);
      const xHi = Math.min(w, Math.max(x1, x2) + minor);
      const yTop = Math.min(h, yRowTop);
      const yBot = Math.min(h, yRowTop + minor);
      const xStart = Math.floor(xLo / minor) * minor;
      const xEnd = Math.ceil(xHi / minor) * minor;

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.35;

      ctx.beginPath();
      ctx.moveTo(xLo, yTop + 0.5);
      ctx.lineTo(xHi, yTop + 0.5);
      ctx.stroke();

      if (yBot > yTop + 0.5) {
        ctx.beginPath();
        ctx.moveTo(xLo, yBot + 0.5);
        ctx.lineTo(xHi, yBot + 0.5);
        ctx.stroke();
      }

      for (let x = xStart; x <= xEnd; x += minor) {
        const xs = x + 0.5;
        ctx.beginPath();
        ctx.moveTo(xs, yTop);
        ctx.lineTo(xs, yBot);
        ctx.stroke();
      }

      ctx.lineWidth = 1;
    }
  }

  ctx.restore();
}

/** קווי עוגן (מרכז אופקי + קו עליון של תיבת האות) — ליישור ניקוד */
export function drawAnchorGuides(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  anchorX: number,
  anchorY: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(37, 99, 235, 0.45)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(anchorX + 0.5, 0);
  ctx.lineTo(anchorX + 0.5, h);
  ctx.moveTo(0, anchorY + 0.5);
  ctx.lineTo(w, anchorY + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
